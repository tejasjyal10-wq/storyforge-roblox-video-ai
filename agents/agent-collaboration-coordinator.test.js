
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const AgentCollaborationCoordinator = require('./agent-collaboration-coordinator');

function createCoordinator(options = {}) {
  return new AgentCollaborationCoordinator(options);
}

test('creates a collaboration task', () => {
  const coordinator = createCoordinator();

  const result = coordinator.createTask({
    title: 'Story development',
    agents: ['writer', 'world-builder']
  });

  assert.equal(result.success, true);
  assert.equal(result.task.status, 'pending');
  assert.equal(result.task.agents.length, 2);
});

test('rejects missing task title', () => {
  const coordinator = createCoordinator();

  const result = coordinator.createTask({
    agents: ['writer']
  });

  assert.equal(result.success, false);
});

test('rejects tasks without agents', () => {
  const coordinator = createCoordinator();

  const result = coordinator.createTask({
    title: 'Empty collaboration',
    agents: []
  });

  assert.equal(result.success, false);
});

test('rejects invalid agent identifiers', () => {
  const coordinator = createCoordinator();

  const result = coordinator.createTask({
    title: 'Invalid agents',
    agents: ['writer', '']
  });

  assert.equal(result.success, false);
});

test('deduplicates assigned agents', () => {
  const coordinator = createCoordinator();

  const result = coordinator.createTask({
    title: 'Duplicate agent test',
    agents: ['writer', 'writer', 'director']
  });

  assert.equal(result.success, true);
  assert.equal(result.task.agents.length, 2);
});

test('starts a pending task', () => {
  const coordinator = createCoordinator();

  const created = coordinator.createTask({
    title: 'Start test',
    agents: ['writer']
  });

  const result = coordinator.startTask(created.task.id);

  assert.equal(result.success, true);
  assert.equal(result.task.status, 'running');
});

test('rejects starting a task twice', () => {
  const coordinator = createCoordinator();

  const created = coordinator.createTask({
    title: 'Double start',
    agents: ['writer']
  });

  coordinator.startTask(created.task.id);

  const result = coordinator.startTask(created.task.id);

  assert.equal(result.success, false);
});

test('collects agent results', () => {
  const coordinator = createCoordinator();

  const created = coordinator.createTask({
    title: 'Result collection',
    agents: ['writer', 'director']
  });

  coordinator.startTask(created.task.id);

  coordinator.submitResult(
    created.task.id,
    'writer',
    { draft: 'Story draft' }
  );

  coordinator.submitResult(
    created.task.id,
    'director',
    { scenes: 5 }
  );

  assert.equal(created.task.results.length, 2);
});

test('rejects results from unassigned agents', () => {
  const coordinator = createCoordinator();

  const created = coordinator.createTask({
    title: 'Unauthorized agent',
    agents: ['writer']
  });

  coordinator.startTask(created.task.id);

  const result = coordinator.submitResult(
    created.task.id,
    'unknown',
    'result'
  );

  assert.equal(result.success, false);
});

test('rejects duplicate results from the same agent', () => {
  const coordinator = createCoordinator();

  const created = coordinator.createTask({
    title: 'Duplicate result',
    agents: ['writer']
  });

  coordinator.startTask(created.task.id);

  coordinator.submitResult(
    created.task.id,
    'writer',
    'first'
  );

  const duplicate = coordinator.submitResult(
    created.task.id,
    'writer',
    'second'
  );

  assert.equal(duplicate.success, false);
});

test('tracks agent failures', () => {
  const coordinator = createCoordinator();

  const created = coordinator.createTask({
    title: 'Failure tracking',
    agents: ['writer', 'director']
  });

  coordinator.startTask(created.task.id);

  coordinator.failAgent(
    created.task.id,
    'writer',
    'Writer unavailable'
  );

  assert.equal(
    created.task.agents[0].status,
    'failed'
  );
});

test('rejects completion while agents remain pending', () => {
  const coordinator = createCoordinator();

  const created = coordinator.createTask({
    title: 'Pending agent',
    agents: ['writer', 'director']
  });

  coordinator.startTask(created.task.id);

  coordinator.submitResult(
    created.task.id,
    'writer',
    'Draft'
  );

  const result = coordinator.completeTask(created.task.id);

  assert.equal(result.success, false);
  assert.ok(result.pending.includes('director'));
});

test('completes task when all agents succeed', () => {
  const coordinator = createCoordinator();

  const created = coordinator.createTask({
    title: 'Successful collaboration',
    agents: ['writer', 'director']
  });

  coordinator.startTask(created.task.id);

  coordinator.submitResult(
    created.task.id,
    'writer',
    'Draft'
  );

  coordinator.submitResult(
    created.task.id,
    'director',
    'Direction'
  );

  const result = coordinator.completeTask(created.task.id);

  assert.equal(result.success, true);
  assert.equal(created.task.status, 'completed');
  assert.equal(result.partial, false);
});

test('fails task when agent fails and partial completion is disabled', () => {
  const coordinator = createCoordinator();

  const created = coordinator.createTask({
    title: 'Strict collaboration',
    agents: ['writer', 'director']
  });

  coordinator.startTask(created.task.id);

  coordinator.submitResult(
    created.task.id,
    'writer',
    'Draft'
  );

  coordinator.failAgent(
    created.task.id,
    'director',
    'Unavailable'
  );

  const result = coordinator.completeTask(created.task.id);

  assert.equal(result.success, false);
  assert.equal(created.task.status, 'failed');
});

test('supports partial completion', () => {
  const coordinator = createCoordinator();

  const created = coordinator.createTask({
    title: 'Partial collaboration',
    agents: ['writer', 'director']
  });

  coordinator.startTask(created.task.id);

  coordinator.submitResult(
    created.task.id,
    'writer',
    'Draft'
  );

  coordinator.failAgent(
    created.task.id,
    'director',
    'Unavailable'
  );

  const result = coordinator.completeTask(
    created.task.id,
    { allowPartial: true }
  );

  assert.equal(result.success, true);
  assert.equal(result.partial, true);
  assert.equal(created.task.status, 'completed_partial');
});

test('retrieves tasks by status', () => {
  const coordinator = createCoordinator();

  coordinator.createTask({
    title: 'Pending task',
    agents: ['writer']
  });

  const running = coordinator.createTask({
    title: 'Running task',
    agents: ['director']
  });

  coordinator.startTask(running.task.id);

  const results = coordinator.getTasks({
    status: 'running'
  });

  assert.equal(results.length, 1);
  assert.equal(results[0].title, 'Running task');
});

test('retrieves tasks by assigned agent', () => {
  const coordinator = createCoordinator();

  coordinator.createTask({
    title: 'Writing task',
    agents: ['writer']
  });

  coordinator.createTask({
    title: 'Direction task',
    agents: ['director']
  });

  const results = coordinator.getTasks({
    agentId: 'writer'
  });

  assert.equal(results.length, 1);
  assert.equal(results[0].title, 'Writing task');
});

test('records collaboration history', () => {
  const coordinator = createCoordinator();

  const created = coordinator.createTask({
    title: 'History test',
    agents: ['writer']
  });

  coordinator.startTask(created.task.id);

  const history = coordinator.getHistory({
    taskId: created.task.id
  });

  assert.ok(history.length >= 2);
});

test('limits history size', () => {
  const coordinator = createCoordinator({
    maxHistory: 2
  });

  const created = coordinator.createTask({
    title: 'History capacity',
    agents: ['writer']
  });

  coordinator.startTask(created.task.id);

  assert.ok(coordinator.history.length <= 2);
});

test('enforces task capacity', () => {
  const coordinator = createCoordinator({
    maxTasks: 1
  });

  const first = coordinator.createTask({
    title: 'First task',
    agents: ['writer']
  });

  const second = coordinator.createTask({
    title: 'Second task',
    agents: ['director']
  });

  assert.equal(first.success, true);
  assert.equal(second.success, false);
});

test('returns task statistics', () => {
  const coordinator = createCoordinator();

  coordinator.createTask({
    title: 'Pending',
    agents: ['writer']
  });

  const running = coordinator.createTask({
    title: 'Running',
    agents: ['director']
  });

  coordinator.startTask(running.task.id);

  const stats = coordinator.getStats();

  assert.equal(stats.totalTasks, 2);
  assert.equal(stats.pending, 1);
  assert.equal(stats.running, 1);
});

test('removes a task', () => {
  const coordinator = createCoordinator();

  const created = coordinator.createTask({
    title: 'Remove test',
    agents: ['writer']
  });

  const result = coordinator.removeTask(created.task.id);

  assert.equal(result.success, true);
  assert.equal(coordinator.getTask(created.task.id), null);
});

test('clears collaboration history', () => {
  const coordinator = createCoordinator();

  coordinator.createTask({
    title: 'Clear history',
    agents: ['writer']
  });

  coordinator.clearHistory();

  assert.equal(coordinator.history.length, 0);
});
    

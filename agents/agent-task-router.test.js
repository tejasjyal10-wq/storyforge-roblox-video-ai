
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const AgentTaskRouter = require('./agent-task-router');

function createRouter(options = {}) {
  return new AgentTaskRouter(options);
}

function registerBasicAgents(router) {
  router.registerAgent({
    id: 'agent-a',
    name: 'Creative Agent',
    capabilities: ['story', 'design']
  });

  router.registerAgent({
    id: 'agent-b',
    name: 'Technical Agent',
    capabilities: ['coding', 'testing']
  });

  router.registerAgent({
    id: 'agent-c',
    name: 'General Agent',
    capabilities: ['story', 'coding', 'testing', 'design'],
    maxConcurrentTasks: 3
  });
}

// 1. Initialization
test('initializes with empty agents and assignments', () => {
  const router = createRouter();

  assert.equal(router.getStats().totalAgents, 0);
  assert.equal(router.getStats().totalAssignments, 0);
});

// 2. Agent registration
test('registers an agent successfully', () => {
  const router = createRouter();

  const result = router.registerAgent({
    id: 'a1',
    name: 'Agent One',
    capabilities: ['story', 'design']
  });

  assert.equal(result.success, true);
  assert.equal(result.agent.id, 'a1');
});

// 3. Reject missing ID
test('rejects registration without agent ID', () => {
  const router = createRouter();

  const result = router.registerAgent({
    name: 'Agent One'
  });

  assert.equal(result.success, false);
});

// 4. Reject missing name
test('rejects registration without agent name', () => {
  const router = createRouter();

  const result = router.registerAgent({
    id: 'a1'
  });

  assert.equal(result.success, false);
});

// 5. Reject invalid capabilities
test('rejects non-array capabilities', () => {
  const router = createRouter();

  const result = router.registerAgent({
    id: 'a1',
    name: 'Agent One',
    capabilities: 'coding'
  });

  assert.equal(result.success, false);
});

// 6. Reject duplicate agents
test('rejects duplicate agent IDs', () => {
  const router = createRouter();

  router.registerAgent({
    id: 'a1',
    name: 'Agent One'
  });

  const result = router.registerAgent({
    id: 'a1',
    name: 'Agent Two'
  });

  assert.equal(result.success, false);
});

// 7. Capability normalization
test('normalizes and deduplicates capabilities', () => {
  const router = createRouter();

  const result = router.registerAgent({
    id: 'a1',
    name: 'Agent One',
    capabilities: ['Coding', 'coding', ' TESTING ']
  });

  assert.deepEqual(
    result.agent.capabilities,
    ['coding', 'testing']
  );
});

// 8. Invalid concurrency limit
test('rejects invalid maxConcurrentTasks', () => {
  const router = createRouter();

  const result = router.registerAgent({
    id: 'a1',
    name: 'Agent One',
    maxConcurrentTasks: 0
  });

  assert.equal(result.success, false);
});

// 9. Agent capacity
test('enforces maximum agent capacity', () => {
  const router = createRouter({ maxAgents: 1 });

  router.registerAgent({
    id: 'a1',
    name: 'Agent One'
  });

  const result = router.registerAgent({
    id: 'a2',
    name: 'Agent Two'
  });

  assert.equal(result.success, false);
  assert.match(result.error, /capacity/i);
});

// 10. Task capability routing
test('routes task to an agent with matching capabilities', () => {
  const router = createRouter();
  registerBasicAgents(router);

  const result = router.assignTask({
    taskId: 'task-1',
    title: 'Write story',
    requiredCapabilities: ['story']
  });

  assert.equal(result.success, true);
  assert.ok(result.agent.capabilities.includes('story'));
});

// 11. No capability match
test('rejects tasks when no agent matches', () => {
  const router = createRouter();
  registerBasicAgents(router);

  const result = router.assignTask({
    taskId: 'task-1',
    title: 'Unknown task',
    requiredCapabilities: ['quantum-physics']
  });

  assert.equal(result.success, false);
});

// 12. Reject missing task ID
test('rejects tasks without IDs', () => {
  const router = createRouter();
  registerBasicAgents(router);

  const result = router.assignTask({
    title: 'Task without ID'
  });

  assert.equal(result.success, false);
});

// 13. Reject missing task title
test('rejects tasks without titles', () => {
  const router = createRouter();
  registerBasicAgents(router);

  const result = router.assignTask({
    taskId: 'task-1'
  });

  assert.equal(result.success, false);
});

// 14. Reject invalid capabilities
test('rejects non-array required capabilities', () => {
  const router = createRouter();
  registerBasicAgents(router);

  const result = router.assignTask({
    taskId: 'task-1',
    title: 'Invalid Task',
    requiredCapabilities: 'coding'
  });

  assert.equal(result.success, false);
});

// 15. Duplicate task assignment
test('rejects duplicate task IDs', () => {
  const router = createRouter();
  registerBasicAgents(router);

  router.assignTask({
    taskId: 'task-1',
    title: 'Task One',
    requiredCapabilities: ['story']
  });

  const result = router.assignTask({
    taskId: 'task-1',
    title: 'Task One Again',
    requiredCapabilities: ['story']
  });

  assert.equal(result.success, false);
});

// 16. Agent availability
test('does not assign work to unavailable agents', () => {
  const router = createRouter();

  router.registerAgent({
    id: 'a1',
    name: 'Agent One',
    capabilities: ['coding']
  });

  router.setAgentAvailability('a1', false);

  const result = router.assignTask({
    taskId: 'task-1',
    title: 'Code task',
    requiredCapabilities: ['coding']
  });

  assert.equal(result.success, false);
});

// 17. Availability validation
test('validates agent availability values', () => {
  const router = createRouter();

  router.registerAgent({
    id: 'a1',
    name: 'Agent One'
  });

  const result = router.setAgentAvailability('a1', 'yes');

  assert.equal(result.success, false);
});

// 18. Workload balancing
test('routes new tasks to the least-loaded eligible agent', () => {
  const router = createRouter();

  router.registerAgent({
    id: 'a1',
    name: 'Agent One',
    capabilities: ['coding'],
    maxConcurrentTasks: 3
  });

  router.registerAgent({
    id: 'a2',
    name: 'Agent Two',
    capabilities: ['coding'],
    maxConcurrentTasks: 3
  });

  const first = router.assignTask({
    taskId: 'task-1',
    title: 'First task',
    requiredCapabilities: ['coding']
  });

  const second = router.assignTask({
    taskId: 'task-2',
    title: 'Second task',
    requiredCapabilities: ['coding']
  });

  assert.equal(first.agent.id, 'a1');
  assert.equal(second.agent.id, 'a2');
});

// 19. Concurrency limits
test('does not exceed an agent concurrency limit', () => {
  const router = createRouter();

  router.registerAgent({
    id: 'a1',
    name: 'Agent One',
    capabilities: ['coding'],
    maxConcurrentTasks: 1
  });

  router.registerAgent({
    id: 'a2',
    name: 'Agent Two',
    capabilities: ['coding'],
    maxConcurrentTasks: 1
  });

  const first = router.assignTask({
    taskId: 'task-1',
    title: 'First task',
    requiredCapabilities: ['coding']
  });

  const second = router.assignTask({
    taskId: 'task-2',
    title: 'Second task',
    requiredCapabilities: ['coding']
  });

  assert.equal(first.success, true);
  assert.equal(second.success, true);
  assert.notEqual(first.agent.id, second.agent.id);
});

// 20. Complete assignment
test('completes assignment and records result', () => {
  const router = createRouter();
  registerBasicAgents(router);

  router.assignTask({
    taskId: 'task-1',
    title: 'Story task',
    requiredCapabilities: ['story']
  });

  const result = router.completeAssignment(
    'task-1',
    { output: 'Completed' }
  );

  assert.equal(result.success, true);
  assert.equal(result.assignment.status, 'completed');
  assert.deepEqual(result.assignment.result, { output: 'Completed' });
});

// 21. Failed assignment
test('records failed assignments', () => {
  const router = createRouter();
  registerBasicAgents(router);

  router.assignTask({
    taskId: 'task-1',
    title: 'Story task',
    requiredCapabilities: ['story']
  });

  const result = router.failAssignment(
    'task-1',
    new Error('Agent error')
  );

  assert.equal(result.success, true);
  assert.equal(result.assignment.status, 'failed');
  assert.equal(result.assignment.error, 'Agent error');
});

// 22. Reassignment
test('reassigns active task to another eligible agent', () => {
  const router = createRouter();

  router.registerAgent({
    id: 'a1',
    name: 'Agent One',
    capabilities: ['coding']
  });

  router.registerAgent({
    id: 'a2',
    name: 'Agent Two',
    capabilities: ['coding']
  });

  const original = router.assignTask({
    taskId: 'task-1',
    title: 'Coding task',
    requiredCapabilities: ['coding']
  });

  const result = router.reassignTask('task-1');

  assert.equal(result.success, true);
  assert.notEqual(
    result.newAssignment.agentId,
    original.assignment.agentId
  );
});

// 23. Prevent unregister with active assignments
test('prevents unregistering agent with active work', () => {
  const router = createRouter();

  router.registerAgent({
    id: 'a1',
    name: 'Agent One',
    capabilities: ['coding']
  });

  router.assignTask({
    taskId: 'task-1',
    title: 'Coding task',
    requiredCapabilities: ['coding']
  });

  const result = router.unregisterAgent('a1');

  assert.equal(result.success, false);
});

// 24. Unregister idle agent
test('unregisters agent without active assignments', () => {
  const router = createRouter();

  router.registerAgent({
    id: 'a1',
    name: 'Agent One'
  });

  const result = router.unregisterAgent('a1');

  assert.equal(result.success, true);
  assert.equal(router.getAgent('a1'), null);
});

// 25. Agent filtering
test('filters agents by availability and capability', () => {
  const router = createRouter();
  registerBasicAgents(router);

  router.setAgentAvailability('agent-b', false);

  const available = router.getAgents({ available: true });
  const coding = router.getAgents({ capability: 'coding' });

  assert.equal(available.every(agent => agent.available), true);
  assert.ok(coding.every(agent => agent.capabilities.includes('coding')));
});

// 26. Assignment filtering
test('filters assignments by agent and status', () => {
  const router = createRouter();
  registerBasicAgents(router);

  router.assignTask({
    taskId: 'task-1',
    title: 'Coding',
    requiredCapabilities: ['coding']
  });

  const active = router.getAssignments({ status: 'assigned' });

  assert.equal(active.length, 1);
  assert.equal(active[0].status, 'assigned');
});

// 27. Statistics
test('returns accurate router statistics', () => {
  const router = createRouter();
  registerBasicAgents(router);

  router.assignTask({
    taskId: 'task-1',
    title: 'Coding',
    requiredCapabilities: ['coding']
  });

  const stats = router.getStats();

  assert.equal(stats.totalAgents, 3);
  assert.equal(stats.totalAssignments, 1);
  assert.equal(stats.activeAssignments, 1);
});

// 28. Assignment capacity
test('enforces assignment capacity', () => {
  const router = createRouter({ maxAssignments: 1 });

  router.registerAgent({
    id: 'a1',
    name: 'Agent One',
    capabilities: ['coding'],
    maxConcurrentTasks: 5
  });

  router.assignTask({
    taskId: 'task-1',
    title: 'First',
    requiredCapabilities: ['coding']
  });

  const result = router.assignTask({
    taskId: 'task-2',
    title: 'Second',
    requiredCapabilities: ['coding']
  });

  assert.equal(result.success, false);
  assert.match(result.error, /capacity/i);
});

// 29. Missing agent lookup
test('returns null for missing agent', () => {
  const router = createRouter();

  assert.equal(router.getAgent('missing'), null);
});

// 30. Missing assignment lookup
test('returns null for missing assignment', () => {
  const router = createRouter();

  assert.equal(router.getAssignment('missing'), null);
});


'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const AgentWorkflowPlanner = require('./agent-workflow-planner');

function createPlanner() {
  return new AgentWorkflowPlanner();
}

function sampleTasks() {
  return [
    { id: 'A', title: 'Research' },
    { id: 'B', title: 'Design', dependencies: ['A'] },
    { id: 'C', title: 'Development', dependencies: ['B'] },
    { id: 'D', title: 'Testing', dependencies: ['C'] }
  ];
}

// 1. Planner initialization
test('initializes planner with empty plans', () => {
  const planner = createPlanner();

  assert.equal(planner.getPlans().length, 0);
  assert.equal(planner.getStats().totalPlans, 0);
});

// 2. Create plan
test('creates a valid workflow plan', () => {
  const planner = createPlanner();

  const result = planner.createPlan({
    title: 'Test Workflow',
    tasks: sampleTasks()
  });

  assert.equal(result.success, true);
  assert.equal(result.plan.title, 'Test Workflow');
  assert.equal(result.plan.tasks.length, 4);
  assert.equal(result.plan.status, 'pending');
});

// 3. Reject empty title
test('rejects an empty plan title', () => {
  const planner = createPlanner();

  const result = planner.createPlan({
    title: '',
    tasks: sampleTasks()
  });

  assert.equal(result.success, false);
});

// 4. Reject empty tasks
test('rejects plans without tasks', () => {
  const planner = createPlanner();

  const result = planner.createPlan({
    title: 'Empty Plan',
    tasks: []
  });

  assert.equal(result.success, false);
});

// 5. Reject duplicate task IDs
test('rejects duplicate task IDs', () => {
  const planner = createPlanner();

  const result = planner.createPlan({
    title: 'Duplicate IDs',
    tasks: [
      { id: 'A', title: 'First' },
      { id: 'A', title: 'Second' }
    ]
  });

  assert.equal(result.success, false);
  assert.match(result.error, /Duplicate task ID/);
});

// 6. Reject missing task ID
test('rejects tasks without IDs', () => {
  const planner = createPlanner();

  const result = planner.createPlan({
    title: 'Invalid Task',
    tasks: [
      { title: 'Missing ID' }
    ]
  });

  assert.equal(result.success, false);
});

// 7. Reject missing task title
test('rejects tasks without titles', () => {
  const planner = createPlanner();

  const result = planner.createPlan({
    title: 'Invalid Task',
    tasks: [
      { id: 'A' }
    ]
  });

  assert.equal(result.success, false);
});

// 8. Reject unknown dependency
test('rejects unknown dependencies', () => {
  const planner = createPlanner();

  const result = planner.createPlan({
    title: 'Unknown Dependency',
    tasks: [
      { id: 'A', title: 'Task A', dependencies: ['UNKNOWN'] }
    ]
  });

  assert.equal(result.success, false);
  assert.match(result.error, /unknown dependency/i);
});

// 9. Reject self-dependency
test('rejects self-dependencies', () => {
  const planner = createPlanner();

  const result = planner.createPlan({
    title: 'Self Dependency',
    tasks: [
      { id: 'A', title: 'Task A', dependencies: ['A'] }
    ]
  });

  assert.equal(result.success, false);
  assert.match(result.error, /cannot depend on itself/i);
});

// 10. Detect circular dependencies
test('rejects circular dependency chains', () => {
  const planner = createPlanner();

  const result = planner.createPlan({
    title: 'Circular Workflow',
    tasks: [
      { id: 'A', title: 'Task A', dependencies: ['C'] },
      { id: 'B', title: 'Task B', dependencies: ['A'] },
      { id: 'C', title: 'Task C', dependencies: ['B'] }
    ]
  });

  assert.equal(result.success, false);
  assert.match(result.error, /cycle/i);
});

// 11. Execution order
test('builds correct execution order', () => {
  const planner = createPlanner();

  const result = planner.createPlan({
    title: 'Execution Order',
    tasks: [
      { id: 'A', title: 'Task A' },
      { id: 'B', title: 'Task B', dependencies: ['A'] },
      { id: 'C', title: 'Task C', dependencies: ['A'] },
      { id: 'D', title: 'Task D', dependencies: ['B', 'C'] }
    ]
  });

  assert.equal(result.success, true);

  assert.deepEqual(result.plan.executionOrder, [
    ['A'],
    ['B', 'C'],
    ['D']
  ]);
});

// 12. Independent tasks can run in parallel
test('identifies independent tasks in the same execution layer', () => {
  const planner = createPlanner();

  const result = planner.createPlan({
    title: 'Parallel Tasks',
    tasks: [
      { id: 'A', title: 'Task A' },
      { id: 'B', title: 'Task B' },
      { id: 'C', title: 'Task C' }
    ]
  });

  assert.equal(result.success, true);

  assert.deepEqual(result.plan.executionOrder, [
    ['A', 'B', 'C']
  ]);
});

// 13. Start plan
test('starts a pending plan', () => {
  const planner = createPlanner();

  const result = planner.createPlan({
    title: 'Start Plan',
    tasks: sampleTasks()
  });

  const started = planner.startPlan(result.plan.id);

  assert.equal(started.success, true);
  assert.equal(started.plan.status, 'running');
});

// 14. Reject starting a plan twice
test('rejects starting an already running plan', () => {
  const planner = createPlanner();

  const result = planner.createPlan({
    title: 'Double Start',
    tasks: sampleTasks()
  });

  planner.startPlan(result.plan.id);

  const secondStart = planner.startPlan(result.plan.id);

  assert.equal(secondStart.success, false);
});

// 15. Ready task detection
test('returns only dependency-ready tasks', () => {
  const planner = createPlanner();

  const result = planner.createPlan({
    title: 'Ready Tasks',
    tasks: [
      { id: 'A', title: 'Task A' },
      { id: 'B', title: 'Task B' },
      { id: 'C', title: 'Task C', dependencies: ['A'] }
    ]
  });

  planner.startPlan(result.plan.id);

  const ready = planner.getReadyTasks(result.plan.id);

  assert.deepEqual(
    ready.map(task => task.id),
    ['A', 'B']
  );
});

// 16. Prevent task execution before dependency completion
test('prevents starting tasks with incomplete dependencies', () => {
  const planner = createPlanner();

  const result = planner.createPlan({
    title: 'Dependency Protection',
    tasks: [
      { id: 'A', title: 'Task A' },
      { id: 'B', title: 'Task B', dependencies: ['A'] }
    ]
  });

  planner.startPlan(result.plan.id);

  const started = planner.startTask(result.plan.id, 'B');

  assert.equal(started.success, false);
  assert.match(started.error, /dependencies/i);
});

// 17. Start and complete task
test('starts and completes a task', () => {
  const planner = createPlanner();

  const result = planner.createPlan({
    title: 'Task Lifecycle',
    tasks: [
      { id: 'A', title: 'Task A' }
    ]
  });

  planner.startPlan(result.plan.id);
  planner.startTask(result.plan.id, 'A');

  const completed = planner.completeTask(
    result.plan.id,
    'A',
    { output: 'Success' }
  );

  assert.equal(completed.success, true);
  assert.equal(completed.task.status, 'completed');
  assert.deepEqual(completed.task.result, { output: 'Success' });
});

// 18. Unlock dependent task after completion
test('unlocks dependent tasks after prerequisite completion', () => {
  const planner = createPlanner();

  const result = planner.createPlan({
    title: 'Dependency Progress',
    tasks: [
      { id: 'A', title: 'Task A' },
      { id: 'B', title: 'Task B', dependencies: ['A'] }
    ]
  });

  planner.startPlan(result.plan.id);

  planner.startTask(result.plan.id, 'A');
  planner.completeTask(result.plan.id, 'A');

  const ready = planner.getReadyTasks(result.plan.id);

  assert.deepEqual(
    ready.map(task => task.id),
    ['B']
  );
});

// 19. Complete entire plan
test('marks plan completed when all tasks finish', () => {
  const planner = createPlanner();

  const result = planner.createPlan({
    title: 'Complete Workflow',
    tasks: [
      { id: 'A', title: 'Task A' },
      { id: 'B', title: 'Task B', dependencies: ['A'] }
    ]
  });

  const planId = result.plan.id;

  planner.startPlan(planId);

  planner.startTask(planId, 'A');
  planner.completeTask(planId, 'A');

  planner.startTask(planId, 'B');
  planner.completeTask(planId, 'B');

  assert.equal(planner.getPlan(planId).status, 'completed');
});

// 20. Task failure
test('marks plan failed when a task fails', () => {
  const planner = createPlanner();

  const result = planner.createPlan({
    title: 'Failing Workflow',
    tasks: [
      { id: 'A', title: 'Task A' }
    ]
  });

  const planId = result.plan.id;

  planner.startPlan(planId);
  planner.startTask(planId, 'A');

  const failed = planner.failTask(
    planId,
    'A',
    new Error('Something went wrong')
  );

  assert.equal(failed.success, true);
  assert.equal(failed.task.status, 'failed');
  assert.equal(failed.task.error, 'Something went wrong');
  assert.equal(failed.plan.status, 'failed');
});

// 21. Progress tracking
test('calculates task progress correctly', () => {
  const planner = createPlanner();

  const result = planner.createPlan({
    title: 'Progress Tracking',
    tasks: [
      { id: 'A', title: 'Task A' },
      { id: 'B', title: 'Task B' },
      { id: 'C', title: 'Task C' },
      { id: 'D', title: 'Task D' }
    ]
  });

  const planId = result.plan.id;

  planner.startPlan(planId);

  planner.startTask(planId, 'A');
  planner.completeTask(planId, 'A');

  planner.startTask(planId, 'B');

  const progress = planner.getProgress(planId);

  assert.equal(progress.total, 4);
  assert.equal(progress.completed, 1);
  assert.equal(progress.running, 1);
  assert.equal(progress.pending, 2);
  assert.equal(progress.failed, 0);
  assert.equal(progress.percentage, 25);
});

// 22. Plan filtering
test('filters plans by status', () => {
  const planner = createPlanner();

  planner.createPlan({
    title: 'Plan 1',
    tasks: [{ id: 'A', title: 'Task A' }]
  });

  const second = planner.createPlan({
    title: 'Plan 2',
    tasks: [{ id: 'B', title: 'Task B' }]
  });

  planner.startPlan(second.plan.id);

  assert.equal(planner.getPlans({ status: 'pending' }).length, 1);
  assert.equal(planner.getPlans({ status: 'running' }).length, 1);
});

// 23. Plan removal
test('removes a plan', () => {
  const planner = createPlanner();

  const result = planner.createPlan({
    title: 'Remove Plan',
    tasks: [{ id: 'A', title: 'Task A' }]
  });

  const removed = planner.removePlan(result.plan.id);

  assert.equal(removed.success, true);
  assert.equal(planner.getPlan(result.plan.id), null);
});

// 24. Statistics
test('returns planner statistics', () => {
  const planner = createPlanner();

  planner.createPlan({
    title: 'Plan 1',
    tasks: [
      { id: 'A', title: 'Task A' },
      { id: 'B', title: 'Task B' }
    ]
  });

  planner.createPlan({
    title: 'Plan 2',
    tasks: [
      { id: 'C', title: 'Task C' }
    ]
  });

  const stats = planner.getStats();

  assert.equal(stats.totalPlans, 2);
  assert.equal(stats.pending, 2);
  assert.equal(stats.totalTasks, 3);
});

// 25. Missing plan handling
test('handles unknown plan IDs safely', () => {
  const planner = createPlanner();

  assert.equal(planner.getPlan('missing'), null);
  assert.equal(planner.getProgress('missing'), null);
  assert.deepEqual(planner.getReadyTasks('missing'), []);

  const result = planner.startPlan('missing');

  assert.equal(result.success, false);
});

// 26. Plan capacity
test('enforces maximum plan capacity', () => {
  const planner = new AgentWorkflowPlanner({
    maxPlans: 1
  });

  planner.createPlan({
    title: 'Plan 1',
    tasks: [{ id: 'A', title: 'Task A' }]
  });

  const result = planner.createPlan({
    title: 'Plan 2',
    tasks: [{ id: 'B', title: 'Task B' }]
  });

  assert.equal(result.success, false);
  assert.match(result.error, /capacity/i);
});
    

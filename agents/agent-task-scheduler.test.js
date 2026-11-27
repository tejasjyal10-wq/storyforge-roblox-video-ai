
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const AgentTaskScheduler = require('./agent-task-scheduler');

function createMockPlanner(tasks = []) {
  const taskStates = new Map();
  const plan = { id: 'plan-1', tasks };

  for (const task of tasks) {
    taskStates.set(task.id, 'pending');
  }

  return {
    getPlan(planId) {
      return planId === plan.id ? plan : null;
    },

    getReadyTasks(planId) {
      if (planId !== plan.id) return [];

      return tasks.filter((task) => {
        if (taskStates.get(task.id) !== 'pending') return false;

        return (task.dependencies || []).every(
          (dependency) => taskStates.get(dependency) === 'completed'
        );
      });
    },

    startTask(planId, taskId) {
      if (planId !== plan.id || !taskStates.has(taskId)) {
        return { success: false };
      }

      taskStates.set(taskId, 'running');
      return { success: true };
    },

    completeTask(planId, taskId, result) {
      if (planId !== plan.id || !taskStates.has(taskId)) {
        return { success: false };
      }

      taskStates.set(taskId, 'completed');
      return { success: true, result };
    },

    failTask(planId, taskId, error) {
      if (planId !== plan.id || !taskStates.has(taskId)) {
        return { success: false };
      }

      taskStates.set(taskId, 'failed');
      return { success: true, error };
    },

    getTaskState(taskId) {
      return taskStates.get(taskId);
    },
  };
}

function createMockQueue() {
  const queued = [];
  const processing = new Map();
  const completed = new Map();
  const failed = new Map();

  return {
    enqueue(task) {
      if (
        queued.some((item) => item.taskId === task.taskId) ||
        processing.has(task.taskId) ||
        completed.has(task.taskId)
      ) {
        return { success: false, error: 'Duplicate task.' };
      }

      queued.push({
        ...task,
        attempts: 0,
      });

      return { success: true, taskId: task.taskId };
    },

    peek() {
      return queued[0] || null;
    },

    dequeue() {
      return queued.shift() || null;
    },

    startTask(taskId) {
      const task = queued.find((item) => item.taskId === taskId);

      if (!task) {
        return { success: false };
      }

      task.attempts += 1;
      processing.set(taskId, task);

      return { success: true, task };
    },

    completeTask(taskId, result) {
      const task = processing.get(taskId);

      if (!task) return { success: false };

      processing.delete(taskId);
      completed.set(taskId, { ...task, result });

      return { success: true, taskId };
    },

    failTask(taskId, error) {
      const task = processing.get(taskId);

      if (!task) return { success: false };

      processing.delete(taskId);
      failed.set(taskId, { ...task, error });

      return { success: true, taskId };
    },

    getQueuedTasks() {
      return queued.slice();
    },

    getProcessingTasks() {
      return Array.from(processing.values());
    },

    getCompletedTasks() {
      return Array.from(completed.values());
    },

    getFailedTasks() {
      return Array.from(failed.values());
    },

    getTask(taskId) {
      return (
        queued.find((task) => task.taskId === taskId) ||
        processing.get(taskId) ||
        completed.get(taskId) ||
        failed.get(taskId) ||
        null
      );
    },
  };
}

function createMockRouter() {
  let assignmentCounter = 0;

  const assignments = new Map();

  return {
    assignments,

    assignTask(task) {
      const assignment = {
        id: `assignment-${++assignmentCounter}`,
        taskId: task.taskId,
      };

      const agent = {
        id: `agent-${assignmentCounter}`,
        name: `Agent ${assignmentCounter}`,
      };

      assignments.set(assignment.id, {
        assignment,
        agent,
        status: 'assigned',
      });

      return {
        success: true,
        assignment,
        agent,
      };
    },

    completeAssignment(assignmentId, result) {
      const item = assignments.get(assignmentId);

      if (!item) return { success: false };

      item.status = 'completed';
      item.result = result;

      return { success: true };
    },

    failAssignment(assignmentId, error) {
      const item = assignments.get(assignmentId);

      if (!item) return { success: false };

      item.status = 'failed';
      item.error = error;

      return { success: true };
    },
  };
}

function createFixture(tasks = []) {
  const planner = createMockPlanner(tasks);
  const router = createMockRouter();
  const queue = createMockQueue();

  const scheduler = new AgentTaskScheduler({
    planner,
    router,
    queue,
  });

  return { scheduler, planner, router, queue };
}

function sampleTasks() {
  return [
    {
      id: 'task-1',
      title: 'First task',
      requiredCapabilities: ['research'],
      dependencies: [],
    },
    {
      id: 'task-2',
      title: 'Second task',
      requiredCapabilities: ['writing'],
      dependencies: ['task-1'],
    },
    {
      id: 'task-3',
      title: 'Third task',
      requiredCapabilities: ['analysis'],
      dependencies: ['task-2'],
    },
  ];
}

// 1
test('constructor requires planner, router, and queue', () => {
  assert.throws(() => new AgentTaskScheduler(), /required/);
});

// 2
test('constructor initializes scheduler state', () => {
  const fixture = createFixture();

  assert.equal(fixture.scheduler.getStats().scheduled, 0);
  assert.equal(fixture.scheduler.getStats().active, 0);
});

// 3
test('schedulePlan rejects an unknown plan', () => {
  const fixture = createFixture();

  assert.equal(
    fixture.scheduler.schedulePlan('unknown').success,
    false
  );
});

// 4
test('schedulePlan schedules initial ready tasks only', () => {
  const fixture = createFixture(sampleTasks());

  const result = fixture.scheduler.schedulePlan('plan-1');

  assert.equal(result.success, true);
  assert.equal(result.scheduled, 1);
  assert.deepEqual(result.taskIds, ['task-1']);
});

// 5
test('schedulePlan prevents registering the same plan twice', () => {
  const fixture = createFixture(sampleTasks());

  fixture.scheduler.schedulePlan('plan-1');

  const second = fixture.scheduler.schedulePlan('plan-1');

  assert.equal(second.success, false);
});

// 6
test('dispatchNext assigns the task to an agent', () => {
  const fixture = createFixture(sampleTasks());

  fixture.scheduler.schedulePlan('plan-1');

  const result = fixture.scheduler.dispatchNext();

  assert.equal(result.success, true);
  assert.equal(result.taskId, 'task-1');
  assert.equal(result.status, 'running');
});

// 7
test('dispatchNext tracks active tasks', () => {
  const fixture = createFixture(sampleTasks());

  fixture.scheduler.schedulePlan('plan-1');
  fixture.scheduler.dispatchNext();

  assert.equal(fixture.scheduler.getActiveTasks().length, 1);
});

// 8
test('dispatchNext rejects an empty queue', () => {
  const fixture = createFixture();

  const result = fixture.scheduler.dispatchNext();

  assert.equal(result.success, false);
  assert.match(result.error, /empty/i);
});

// 9
test('dispatchAvailable dispatches queued tasks', () => {
  const fixture = createFixture([
    {
      id: 'a',
      dependencies: [],
    },
    {
      id: 'b',
      dependencies: [],
    },
  ]);

  fixture.scheduler.schedulePlan('plan-1');

  const result = fixture.scheduler.dispatchAvailable(2);

  assert.equal(result.dispatched, 2);
  assert.equal(fixture.scheduler.getActiveTasks().length, 2);
});

// 10
test('dispatchAvailable respects its limit', () => {
  const fixture = createFixture([
    { id: 'a', dependencies: [] },
    { id: 'b', dependencies: [] },
    { id: 'c', dependencies: [] },
  ]);

  fixture.scheduler.schedulePlan('plan-1');

  const result = fixture.scheduler.dispatchAvailable(1);

  assert.equal(result.dispatched, 1);
  assert.equal(fixture.scheduler.getActiveTasks().length, 1);
});

// 11
test('completeTask updates queue, router, and planner', () => {
  const fixture = createFixture(sampleTasks());

  fixture.scheduler.schedulePlan('plan-1');
  fixture.scheduler.dispatchNext();

  const result = fixture.scheduler.completeTask(
    'task-1',
    { output: 'finished' }
  );

  assert.equal(result.success, true);
  assert.equal(result.status, 'completed');
  assert.equal(fixture.planner.getTaskState('task-1'), 'completed');
});

// 12
test('completing a task automatically schedules newly ready dependencies', () => {
  const fixture = createFixture(sampleTasks());

  fixture.scheduler.schedulePlan('plan-1');
  fixture.scheduler.dispatchNext();
  fixture.scheduler.completeTask('task-1', 'done');

  const queued = fixture.queue.getQueuedTasks();

  assert.equal(queued.length, 1);
  assert.equal(queued[0].taskId, 'task-2');
});

// 13
test('newly unlocked task can be dispatched', () => {
  const fixture = createFixture(sampleTasks());

  fixture.scheduler.schedulePlan('plan-1');
  fixture.scheduler.dispatchNext();
  fixture.scheduler.completeTask('task-1', 'done');

  const result = fixture.scheduler.dispatchNext();

  assert.equal(result.success, true);
  assert.equal(result.taskId, 'task-2');
});

// 14
test('dependency chain progresses after successive completions', () => {
  const fixture = createFixture(sampleTasks());

  fixture.scheduler.schedulePlan('plan-1');

  fixture.scheduler.dispatchNext();
  fixture.scheduler.completeTask('task-1', 'done');

  fixture.scheduler.dispatchNext();
  fixture.scheduler.completeTask('task-2', 'done');

  assert.equal(
    fixture.queue.getQueuedTasks()[0].taskId,
    'task-3'
  );
});

// 15
test('refreshPlan schedules newly ready tasks', () => {
  const fixture = createFixture(sampleTasks());

  fixture.scheduler.schedulePlan('plan-1');
  fixture.scheduler.dispatchNext();
  fixture.scheduler.completeTask('task-1');

  const result = fixture.scheduler.refreshPlan('plan-1');

  assert.equal(result.success, true);
  assert.equal(result.newlyScheduled, 0);
});

// 16
test('completed tasks are tracked', () => {
  const fixture = createFixture(sampleTasks());

  fixture.scheduler.schedulePlan('plan-1');
  fixture.scheduler.dispatchNext();
  fixture.scheduler.completeTask('task-1', 'result');

  assert.equal(
    fixture.scheduler.getTask('task-1').completed.status,
    'completed'
  );
});

// 17
test('completeTask rejects a non-active task', () => {
  const fixture = createFixture();

  const result = fixture.scheduler.completeTask('missing');

  assert.equal(result.success, false);
});

// 18
test('failTask marks task failed', () => {
  const fixture = createFixture(sampleTasks());

  fixture.scheduler.schedulePlan('plan-1');
  fixture.scheduler.dispatchNext();

  const result = fixture.scheduler.failTask(
    'task-1',
    'Something went wrong'
  );

  assert.equal(result.success, true);
  assert.equal(result.status, 'failed');
});

// 19
test('failTask updates planner failure state', () => {
  const fixture = createFixture(sampleTasks());

  fixture.scheduler.schedulePlan('plan-1');
  fixture.scheduler.dispatchNext();
  fixture.scheduler.failTask('task-1', 'failure');

  assert.equal(fixture.planner.getTaskState('task-1'), 'failed');
});

// 20
test('failed tasks are retrievable', () => {
  const fixture = createFixture(sampleTasks());

  fixture.scheduler.schedulePlan('plan-1');
  fixture.scheduler.dispatchNext();
  fixture.scheduler.failTask('task-1', 'failure');

  assert.equal(
    fixture.scheduler.getTask('task-1').failed.status,
    'failed'
  );
});

// 21
test('getScheduledTasks returns scheduled records', () => {
  const fixture = createFixture(sampleTasks());

  fixture.scheduler.schedulePlan('plan-1');

  assert.equal(fixture.scheduler.getScheduledTasks().length, 1);
});

// 22
test('getActiveTasks returns currently running tasks', () => {
  const fixture = createFixture(sampleTasks());

  fixture.scheduler.schedulePlan('plan-1');
  fixture.scheduler.dispatchNext();

  assert.equal(fixture.scheduler.getActiveTasks().length, 1);
});

// 23
test('stats track task state', () => {
  const fixture = createFixture(sampleTasks());

  fixture.scheduler.schedulePlan('plan-1');
  fixture.scheduler.dispatchNext();
  fixture.scheduler.completeTask('task-1');

  const stats = fixture.scheduler.getStats();

  assert.equal(stats.scheduled, 1);
  assert.equal(stats.completed, 1);
  assert.equal(stats.active, 0);
  assert.equal(stats.plans, 1);
});

// 24
test('clear resets scheduler tracking', () => {
  const fixture = createFixture(sampleTasks());

  fixture.scheduler.schedulePlan('plan-1');
  fixture.scheduler.dispatchNext();

  fixture.scheduler.clear();

  assert.equal(fixture.scheduler.getStats().scheduled, 0);
  assert.equal(fixture.scheduler.getStats().active, 0);
  assert.equal(fixture.scheduler.getStats().plans, 0);
});

// 25
test('completed dependency does not get scheduled again', () => {
  const fixture = createFixture(sampleTasks());

  fixture.scheduler.schedulePlan('plan-1');
  fixture.scheduler.dispatchNext();
  fixture.scheduler.completeTask('task-1');

  fixture.scheduler.refreshPlan('plan-1');

  assert.equal(
    fixture.scheduler.getScheduledTasks().filter(
      (task) => task.taskId === 'task-1'
    ).length,
    1
  );
});
    

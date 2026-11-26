'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const AgentTaskQueue = require('./agent-task-queue');

function createQueue(options = {}) {
  return new AgentTaskQueue(options);
}

// 1. Initialization
test('initializes empty queue', () => {
  const queue = createQueue();

  assert.deepEqual(queue.getStats(), {
    queued: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    total: 0
  });
});

// 2. Enqueue
test('enqueues a valid task', () => {
  const queue = createQueue();

  const result = queue.enqueue({
    taskId: 't1',
    title: 'Task One'
  });

  assert.equal(result.success, true);
  assert.equal(result.task.status, 'queued');
});

// 3. Missing ID
test('rejects missing task ID', () => {
  const queue = createQueue();

  const result = queue.enqueue({
    title: 'Task'
  });

  assert.equal(result.success, false);
});

// 4. Missing title
test('rejects missing title', () => {
  const queue = createQueue();

  const result = queue.enqueue({
    taskId: 't1'
  });

  assert.equal(result.success, false);
});

// 5. Priority validation
test('rejects invalid priority', () => {
  const queue = createQueue();

  const result = queue.enqueue({
    taskId: 't1',
    title: 'Task',
    priority: Infinity
  });

  assert.equal(result.success, false);
});

// 6. Retry validation
test('rejects invalid max retries', () => {
  const queue = createQueue();

  const result = queue.enqueue({
    taskId: 't1',
    title: 'Task',
    maxRetries: -1
  });

  assert.equal(result.success, false);
});

// 7. Deduplication
test('rejects duplicate task IDs', () => {
  const queue = createQueue();

  queue.enqueue({
    taskId: 't1',
    title: 'Task One'
  });

  const result = queue.enqueue({
    taskId: 't1',
    title: 'Task One Duplicate'
  });

  assert.equal(result.success, false);
});

// 8. Priority ordering
test('orders tasks by priority', () => {
  const queue = createQueue();

  queue.enqueue({
    taskId: 'low',
    title: 'Low',
    priority: 1
  });

  queue.enqueue({
    taskId: 'high',
    title: 'High',
    priority: 10
  });

  queue.enqueue({
    taskId: 'medium',
    title: 'Medium',
    priority: 5
  });

  assert.deepEqual(
    queue.getQueuedTasks().map(task => task.taskId),
    ['high', 'medium', 'low']
  );
});

// 9. FIFO
test('preserves FIFO order for equal priorities', () => {
  const queue = createQueue();

  queue.enqueue({ taskId: 'a', title: 'A', priority: 5 });
  queue.enqueue({ taskId: 'b', title: 'B', priority: 5 });
  queue.enqueue({ taskId: 'c', title: 'C', priority: 5 });

  assert.deepEqual(
    queue.getQueuedTasks().map(task => task.taskId),
    ['a', 'b', 'c']
  );
});

// 10. Peek
test('peek returns next task without removing it', () => {
  const queue = createQueue();

  queue.enqueue({ taskId: 't1', title: 'Task' });

  const peeked = queue.peek();

  assert.equal(peeked.taskId, 't1');
  assert.equal(queue.getStats().queued, 1);
});

// 11. Dequeue
test('dequeues task into processing', () => {
  const queue = createQueue();

  queue.enqueue({ taskId: 't1', title: 'Task' });

  const task = queue.dequeue();

  assert.equal(task.status, 'processing');
  assert.equal(queue.getStats().processing, 1);
  assert.equal(queue.getStats().queued, 0);
});

// 12. Empty dequeue
test('returns null when dequeuing an empty queue', () => {
  const queue = createQueue();

  assert.equal(queue.dequeue(), null);
});

// 13. Start specific task
test('starts a specific queued task', () => {
  const queue = createQueue();

  queue.enqueue({ taskId: 't1', title: 'Task One' });

  const result = queue.startTask('t1');

  assert.equal(result.success, true);
  assert.equal(result.task.status, 'processing');
});

// 14. Reject starting missing task
test('rejects starting missing task', () => {
  const queue = createQueue();

  const result = queue.startTask('missing');

  assert.equal(result.success, false);
});

// 15. Completion
test('completes a processing task', () => {
  const queue = createQueue();

  queue.enqueue({ taskId: 't1', title: 'Task' });
  queue.dequeue();

  const result = queue.completeTask('t1', { output: 'ok' });

  assert.equal(result.success, true);
  assert.equal(result.task.status, 'completed');
  assert.deepEqual(result.task.result, { output: 'ok' });
  assert.equal(queue.getStats().completed, 1);
});

// 16. Reject completion when not processing
test('rejects completion of queued task', () => {
  const queue = createQueue();

  queue.enqueue({ taskId: 't1', title: 'Task' });

  const result = queue.completeTask('t1');

  assert.equal(result.success, false);
});

// 17. Retry
test('requeues failed task while retries remain', () => {
  const queue = createQueue({ maxRetries: 2 });

  queue.enqueue({ taskId: 't1', title: 'Task' });
  queue.dequeue();

  const result = queue.failTask('t1', 'temporary error');

  assert.equal(result.success, true);
  assert.equal(result.retried, true);
  assert.equal(result.task.status, 'queued');
  assert.equal(result.task.attempts, 1);
});

// 18. Retry limit
test('marks task failed after retry limit is exhausted', () => {
  const queue = createQueue({ maxRetries: 1 });

  queue.enqueue({ taskId: 't1', title: 'Task' });
  queue.dequeue();
  queue.failTask('t1', 'first error');

  queue.dequeue();
  const result = queue.failTask('t1', 'second error');

  assert.equal(result.success, true);
  assert.equal(result.retried, false);
  assert.equal(result.task.status, 'failed');
  assert.equal(queue.getStats().failed, 1);
});

// 19. Cancellation
test('cancels queued task', () => {
  const queue = createQueue();

  queue.enqueue({ taskId: 't1', title: 'Task' });

  const result = queue.cancelTask('t1');

  assert.equal(result.success, true);
  assert.equal(result.task.status, 'cancelled');
  assert.equal(queue.getStats().queued, 0);
});

// 20. Reject cancellation during processing
test('cannot cancel a processing task', () => {
  const queue = createQueue();

  queue.enqueue({ taskId: 't1', title: 'Task' });
  queue.dequeue();

  const result = queue.cancelTask('t1');

  assert.equal(result.success, false);
});

// 21. Capacity
test('enforces maximum queue size', () => {
  const queue = createQueue({ maxQueueSize: 1 });

  queue.enqueue({ taskId: 't1', title: 'Task One' });

  const result = queue.enqueue({
    taskId: 't2',
    title: 'Task Two'
  });

  assert.equal(result.success, false);
  assert.match(result.error, /capacity/i);
});

// 22. Queue getters
test('returns queued and processing tasks', () => {
  const queue = createQueue();

  queue.enqueue({ taskId: 't1', title: 'Task One' });
  queue.enqueue({ taskId: 't2', title: 'Task Two' });

  queue.startTask('t1');

  assert.equal(queue.getQueuedTasks().length, 1);
  assert.equal(queue.getProcessingTasks().length, 1);
});

// 23. Task lookup
test('retrieves task across lifecycle states', () => {
  const queue = createQueue();

  queue.enqueue({ taskId: 't1', title: 'Task One' });

  assert.equal(queue.getTask('t1').status, 'queued');

  queue.dequeue();

  assert.equal(queue.getTask('t1').status, 'processing');
});

// 24. Completed getter
test('returns completed tasks', () => {
  const queue = createQueue();

  queue.enqueue({ taskId: 't1', title: 'Task' });
  queue.dequeue();
  queue.completeTask('t1');

  assert.equal(queue.getCompletedTasks().length, 1);
});

// 25. Failed getter
test('returns failed tasks', () => {
  const queue = createQueue({ maxRetries: 0 });

  queue.enqueue({ taskId: 't1', title: 'Task' });
  queue.dequeue();
  queue.failTask('t1', 'error');

  assert.equal(queue.getFailedTasks().length, 1);
});

// 26. Queue clearing
test('clears queued tasks without affecting processing', () => {
  const queue = createQueue();

  queue.enqueue({ taskId: 't1', title: 'Task One' });
  queue.enqueue({ taskId: 't2', title: 'Task Two' });

  queue.startTask('t1');

  const result = queue.clearQueue();

  assert.equal(result.success, true);
  assert.equal(result.removed, 1);
  assert.equal(queue.getStats().queued, 0);
  assert.equal(queue.getStats().processing, 1);
});

// 27. Statistics
test('reports queue statistics accurately', () => {
  const queue = createQueue();

  queue.enqueue({ taskId: 't1', title: 'Task One' });
  queue.enqueue({ taskId: 't2', title: 'Task Two' });
  queue.startTask('t1');
  queue.completeTask('t1');

  const stats = queue.getStats();

  assert.equal(stats.queued, 1);
  assert.equal(stats.completed, 1);
  assert.equal(stats.processing, 0);
  assert.equal(stats.total, 2);
});

// 28. Unknown task failure
test('handles failing an unknown task', () => {
  const queue = createQueue();

  const result = queue.failTask('missing', 'error');

  assert.equal(result.success, false);
});

// 29. Unknown task cancellation
test('handles cancelling an unknown task', () => {
  const queue = createQueue();

  const result = queue.cancelTask('missing');

  assert.equal(result.success, false);
});

// 30. Metadata preservation
test('preserves task payload and metadata', () => {
  const queue = createQueue();

  const result = queue.enqueue({
    taskId: 't1',
    title: 'Task',
    payload: { input: 42 },
    metadata: { source: 'planner' }
  });

  assert.deepEqual(result.task.payload, { input: 42 });
  assert.deepEqual(result.task.metadata, { source: 'planner' });
});

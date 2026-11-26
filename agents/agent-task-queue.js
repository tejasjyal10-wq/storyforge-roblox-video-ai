
'use strict';

const { randomUUID } = require('node:crypto');

class AgentTaskQueue {
  constructor(options = {}) {
    this.maxQueueSize = options.maxQueueSize ?? 1000;
    this.maxRetries = options.maxRetries ?? 3;

    this.queue = [];
    this.processing = new Map();
    this.completed = new Map();
    this.failed = new Map();
    this.sequence = 0;
  }

  enqueue({
    taskId,
    title,
    payload = null,
    priority = 0,
    maxRetries = this.maxRetries,
    metadata = {}
  } = {}) {
    if (typeof taskId !== 'string' || !taskId.trim()) {
      return { success: false, error: 'Task ID is required.' };
    }

    if (typeof title !== 'string' || !title.trim()) {
      return { success: false, error: 'Task title is required.' };
    }

    if (!Number.isFinite(priority)) {
      return { success: false, error: 'Priority must be finite.' };
    }

    if (!Number.isInteger(maxRetries) || maxRetries < 0) {
      return {
        success: false,
        error: 'maxRetries must be a non-negative integer.'
      };
    }

    if (this.hasTask(taskId)) {
      return { success: false, error: 'Duplicate task ID.' };
    }

    if (this.queue.length >= this.maxQueueSize) {
      return { success: false, error: 'Queue capacity reached.' };
    }

    const task = {
      id: randomUUID(),
      taskId,
      title: title.trim(),
      payload,
      priority,
      maxRetries,
      attempts: 0,
      status: 'queued',
      metadata,
      sequence: this.sequence++,
      queuedAt: Date.now(),
      startedAt: null,
      completedAt: null,
      result: null,
      error: null
    };

    this.queue.push(task);
    this.sortQueue();

    return { success: true, task };
  }

  hasTask(taskId) {
    return (
      this.queue.some(task => task.taskId === taskId) ||
      this.processing.has(taskId) ||
      this.completed.has(taskId) ||
      this.failed.has(taskId)
    );
  }

  sortQueue() {
    this.queue.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }

      return a.sequence - b.sequence;
    });
  }

  peek() {
    return this.queue[0] || null;
  }

  dequeue() {
    const task = this.queue.shift();

    if (!task) {
      return null;
    }

    task.status = 'processing';
    task.attempts += 1;
    task.startedAt = Date.now();

    this.processing.set(task.taskId, task);

    return task;
  }

  startTask(taskId) {
    const index = this.queue.findIndex(
      task => task.taskId === taskId
    );

    if (index === -1) {
      return {
        success: false,
        error: 'Queued task not found.'
      };
    }

    const task = this.queue.splice(index, 1)[0];

    task.status = 'processing';
    task.attempts += 1;
    task.startedAt = Date.now();

    this.processing.set(taskId, task);

    return { success: true, task };
  }

  completeTask(taskId, result = null) {
    const task = this.processing.get(taskId);

    if (!task) {
      return {
        success: false,
        error: 'Task is not processing.'
      };
    }

    task.status = 'completed';
    task.result = result;
    task.completedAt = Date.now();

    this.processing.delete(taskId);
    this.completed.set(taskId, task);

    return { success: true, task };
  }

  failTask(taskId, error) {
    const task = this.processing.get(taskId);

    if (!task) {
      return {
        success: false,
        error: 'Task is not processing.'
      };
    }

    task.error = error instanceof Error
      ? error.message
      : String(error || 'Task failed.');

    this.processing.delete(taskId);

    if (task.attempts <= task.maxRetries) {
      task.status = 'queued';
      task.startedAt = null;
      task.sequence = this.sequence++;

      this.queue.push(task);
      this.sortQueue();

      return {
        success: true,
        retried: true,
        task
      };
    }

    task.status = 'failed';
    task.completedAt = Date.now();

    this.failed.set(taskId, task);

    return {
      success: true,
      retried: false,
      task
    };
  }

  cancelTask(taskId) {
    const index = this.queue.findIndex(
      task => task.taskId === taskId
    );

    if (index === -1) {
      return {
        success: false,
        error: 'Only queued tasks can be cancelled.'
      };
    }

    const [task] = this.queue.splice(index, 1);

    task.status = 'cancelled';
    task.completedAt = Date.now();

    return { success: true, task };
  }

  getTask(taskId) {
    return (
      this.queue.find(task => task.taskId === taskId) ||
      this.processing.get(taskId) ||
      this.completed.get(taskId) ||
      this.failed.get(taskId) ||
      null
    );
  }

  getQueuedTasks() {
    return [...this.queue];
  }

  getProcessingTasks() {
    return [...this.processing.values()];
  }

  getCompletedTasks() {
    return [...this.completed.values()];
  }

  getFailedTasks() {
    return [...this.failed.values()];
  }

  getStats() {
    return {
      queued: this.queue.length,
      processing: this.processing.size,
      completed: this.completed.size,
      failed: this.failed.size,
      total: this.queue.length +
        this.processing.size +
        this.completed.size +
        this.failed.size
    };
  }

  clearQueue() {
    const removed = this.queue.length;
    this.queue = [];

    return {
      success: true,
      removed
    };
  }
}

module.exports = AgentTaskQueue;
      

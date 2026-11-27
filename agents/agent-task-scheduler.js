
'use strict';

class AgentTaskScheduler {
  constructor({ planner, router, queue } = {}) {
    if (!planner || !router || !queue) {
      throw new Error('Planner, router, and queue are required.');
    }

    this.planner = planner;
    this.router = router;
    this.queue = queue;

    this.scheduled = new Map();
    this.active = new Map();
    this.completed = new Map();
    this.failed = new Map();
    this.planTaskMap = new Map();
  }

  schedulePlan(planId) {
    const plan = this.planner.getPlan(planId);

    if (!plan) {
      return { success: false, error: 'Plan not found.' };
    }

    if (this.planTaskMap.has(planId)) {
      return {
        success: false,
        error: 'Plan has already been scheduled.',
      };
    }

    const readyTasks = this.planner.getReadyTasks(planId) || [];
    const scheduledTaskIds = [];

    for (const task of readyTasks) {
      const taskId = task.taskId || task.id;

      if (!taskId || this.scheduled.has(taskId)) {
        continue;
      }

      const queued = this.queue.enqueue({
        taskId,
        title: task.title || task.name || taskId,
        payload: task,
        priority: task.priority || 0,
        metadata: {
          planId,
          ...task.metadata,
        },
      });

      if (!queued || !queued.success) {
        continue;
      }

      this.scheduled.set(taskId, {
        taskId,
        planId,
        status: 'queued',
        task,
        queuedAt: new Date().toISOString(),
      });

      scheduledTaskIds.push(taskId);
    }

    this.planTaskMap.set(planId, scheduledTaskIds);

    return {
      success: true,
      planId,
      scheduled: scheduledTaskIds.length,
      taskIds: scheduledTaskIds,
    };
  }

  dispatchNext() {
    const queuedTask = this.queue.peek();

    if (!queuedTask) {
      return { success: false, error: 'Queue is empty.' };
    }

    const taskId = queuedTask.taskId;

    if (this.active.has(taskId)) {
      return {
        success: false,
        error: 'Task is already active.',
      };
    }

    const task = this.queue.dequeue();

    if (!task) {
      return { success: false, error: 'Unable to dequeue task.' };
    }

    const started = this.queue.startTask(taskId);

    if (!started || !started.success) {
      this.queue.failTask(taskId, 'Unable to start queued task.');

      return {
        success: false,
        taskId,
        error: 'Unable to start queued task.',
      };
    }

    const assignmentResult = this.router.assignTask({
      taskId,
      title: task.title,
      requiredCapabilities:
        task.payload?.requiredCapabilities ||
        task.payload?.capabilities ||
        [],
      priority: task.priority || 0,
      metadata: {
        ...(task.metadata || {}),
        scheduler: true,
      },
    });

    if (!assignmentResult || !assignmentResult.success) {
      this.queue.failTask(
        taskId,
        assignmentResult?.error || 'No suitable agent available.'
      );

      this.failed.set(taskId, {
        taskId,
        status: 'assignment_failed',
        error: assignmentResult?.error || 'No suitable agent available.',
        failedAt: new Date().toISOString(),
      });

      const scheduled = this.scheduled.get(taskId);

      if (scheduled) {
        scheduled.status = 'assignment_failed';
      }

      return {
        success: false,
        taskId,
        error: assignmentResult?.error || 'Assignment failed.',
      };
    }

    const assignment = assignmentResult.assignment;

    const activeTask = {
      taskId,
      planId: task.metadata?.planId || null,
      task,
      assignment,
      agent: assignmentResult.agent,
      status: 'running',
      startedAt: new Date().toISOString(),
    };

    this.active.set(taskId, activeTask);

    const scheduled = this.scheduled.get(taskId);

    if (scheduled) {
      scheduled.status = 'running';
      scheduled.assignmentId = assignment.id;
    }

    if (activeTask.planId) {
      this.planner.startTask(activeTask.planId, task.payload.id || taskId);
    }

    return {
      success: true,
      taskId,
      assignment,
      agent: assignmentResult.agent,
      status: 'running',
    };
  }

  dispatchAvailable(limit = Infinity) {
    const results = [];

    while (results.length < limit && this.queue.getQueuedTasks().length > 0) {
      const result = this.dispatchNext();
      results.push(result);

      if (!result.success) {
        break;
      }
    }

    return {
      success: true,
      dispatched: results.filter((result) => result.success).length,
      results,
    };
  }

  completeTask(taskId, result = null) {
    const activeTask = this.active.get(taskId);

    if (!activeTask) {
      return {
        success: false,
        error: 'Task is not active.',
      };
    }

    const queueResult = this.queue.completeTask(taskId, result);

    if (!queueResult || !queueResult.success) {
      return {
        success: false,
        error: 'Queue could not complete task.',
      };
    }

    this.router.completeAssignment(
      activeTask.assignment.id,
      result
    );

    if (activeTask.planId) {
      this.planner.completeTask(
        activeTask.planId,
        activeTask.task.payload.id || taskId,
        result
      );
    }

    activeTask.status = 'completed';
    activeTask.completedAt = new Date().toISOString();
    activeTask.result = result;

    this.completed.set(taskId, activeTask);
    this.active.delete(taskId);

    const scheduled = this.scheduled.get(taskId);

    if (scheduled) {
      scheduled.status = 'completed';
    }

    return {
      success: true,
      taskId,
      status: 'completed',
      result,
    };
  }

  failTask(taskId, error) {
    const activeTask = this.active.get(taskId);

    if (!activeTask) {
      return {
        success: false,
        error: 'Task is not active.',
      };
    }

    const message =
      error instanceof Error ? error.message : String(error);

    this.queue.failTask(taskId, message);

    this.router.failAssignment(
      activeTask.assignment.id,
      message
    );

    if (activeTask.planId) {
      this.planner.failTask(
        activeTask.planId,
        activeTask.task.payload.id || taskId,
        message
      );
    }

    activeTask.status = 'failed';
    activeTask.error = message;
    activeTask.failedAt = new Date().toISOString();

    this.failed.set(taskId, activeTask);
    this.active.delete(taskId);

    const scheduled = this.scheduled.get(taskId);

    if (scheduled) {
      scheduled.status = 'failed';
    }

    return {
      success: true,
      taskId,
      status: 'failed',
      error: message,
    };
  }

  getTask(taskId) {
    return {
      scheduled: this.scheduled.get(taskId) || null,
      active: this.active.get(taskId) || null,
      completed: this.completed.get(taskId) || null,
      failed: this.failed.get(taskId) || null,
    };
  }

  getActiveTasks() {
    return Array.from(this.active.values());
  }

  getScheduledTasks() {
    return Array.from(this.scheduled.values());
  }

  getStats() {
    return {
      scheduled: this.scheduled.size,
      active: this.active.size,
      completed: this.completed.size,
      failed: this.failed.size,
      plans: this.planTaskMap.size,
    };
  }

  clear() {
    this.scheduled.clear();
    this.active.clear();
    this.completed.clear();
    this.failed.clear();
    this.planTaskMap.clear();

    return { success: true };
  }
}

module.exports = AgentTaskScheduler;
    

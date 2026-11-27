
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

  getPlan(planId) {
    return this.planner.getPlan(planId);
  }

  getTaskId(task) {
    return task.taskId || task.id;
  }

  getReadyTasks(planId) {
    const tasks = this.planner.getReadyTasks(planId) || [];
    return tasks.filter((task) => {
      const taskId = this.getTaskId(task);
      return taskId && !this.scheduled.has(taskId);
    });
  }

  scheduleReadyTasks(planId) {
    const readyTasks = this.getReadyTasks(planId);
    const taskIds = [];

    for (const task of readyTasks) {
      const taskId = this.getTaskId(task);

      const result = this.queue.enqueue({
        taskId,
        title: task.title || task.name || taskId,
        payload: task,
        priority: task.priority || 0,
        metadata: {
          planId,
          ...(task.metadata || {}),
        },
      });

      if (!result || !result.success) {
        continue;
      }

      this.scheduled.set(taskId, {
        taskId,
        planId,
        task,
        status: 'queued',
        queuedAt: new Date().toISOString(),
      });

      taskIds.push(taskId);
    }

    const existing = this.planTaskMap.get(planId) || [];
    this.planTaskMap.set(
      planId,
      [...new Set([...existing, ...taskIds])]
    );

    return taskIds;
  }

  schedulePlan(planId) {
    const plan = this.getPlan(planId);

    if (!plan) {
      return {
        success: false,
        error: 'Plan not found.',
      };
    }

    if (this.planTaskMap.has(planId)) {
      return {
        success: false,
        error: 'Plan already registered.',
      };
    }

    const taskIds = this.scheduleReadyTasks(planId);

    this.planTaskMap.set(
      planId,
      this.planTaskMap.get(planId) || taskIds
    );

    return {
      success: true,
      planId,
      scheduled: taskIds.length,
      taskIds,
    };
  }

  dispatchNext() {
    const queued = this.queue.peek();

    if (!queued) {
      return {
        success: false,
        error: 'Queue is empty.',
      };
    }

    const taskId = queued.taskId;

    if (this.active.has(taskId)) {
      return {
        success: false,
        error: 'Task is already active.',
      };
    }

    const task = this.queue.dequeue();

    if (!task) {
      return {
        success: false,
        error: 'Unable to dequeue task.',
      };
    }

    const started = this.queue.startTask(taskId);

    if (!started || !started.success) {
      this.queue.failTask(taskId, 'Unable to start task.');

      return {
        success: false,
        taskId,
        error: 'Unable to start task.',
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
        assignmentResult?.error || 'Assignment failed.'
      );

      const scheduled = this.scheduled.get(taskId);

      if (scheduled) {
        scheduled.status = 'assignment_failed';
      }

      this.failed.set(taskId, {
        taskId,
        status: 'assignment_failed',
        error: assignmentResult?.error || 'Assignment failed.',
        failedAt: new Date().toISOString(),
      });

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
      this.planner.startTask(
        activeTask.planId,
        task.payload.id || taskId
      );
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

    while (
      results.length < limit &&
      this.queue.getQueuedTasks().length > 0
    ) {
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

  refreshPlan(planId) {
    const taskIds = this.scheduleReadyTasks(planId);

    return {
      success: true,
      planId,
      newlyScheduled: taskIds.length,
      taskIds,
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

    const refreshed = activeTask.planId
      ? this.refreshPlan(activeTask.planId)
      : null;

    return {
      success: true,
      taskId,
      status: 'completed',
      result,
      refreshed,
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

    return {
      success: true,
    };
  }
}

module.exports = AgentTaskScheduler;
    

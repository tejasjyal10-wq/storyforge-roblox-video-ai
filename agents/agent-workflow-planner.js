
'use strict';

const { randomUUID } = require('node:crypto');

class AgentWorkflowPlanner {
  constructor(options = {}) {
    this.maxPlans = options.maxPlans ?? 500;
    this.plans = new Map();
  }

  createPlan({
    title,
    tasks = [],
    metadata = {}
  } = {}) {
    if (typeof title !== 'string' || !title.trim()) {
      return {
        success: false,
        error: 'Plan title is required.'
      };
    }

    if (!Array.isArray(tasks) || tasks.length === 0) {
      return {
        success: false,
        error: 'At least one task is required.'
      };
    }

    if (this.plans.size >= this.maxPlans) {
      return {
        success: false,
        error: 'Plan capacity reached.'
      };
    }

    const normalized = [];
    const ids = new Set();

    for (const task of tasks) {
      if (
        !task ||
        typeof task.id !== 'string' ||
        !task.id.trim() ||
        typeof task.title !== 'string' ||
        !task.title.trim()
      ) {
        return {
          success: false,
          error: 'Every task requires a valid id and title.'
        };
      }

      if (ids.has(task.id)) {
        return {
          success: false,
          error: `Duplicate task ID: ${task.id}`
        };
      }

      ids.add(task.id);

      const dependencies = task.dependencies ?? [];

      if (!Array.isArray(dependencies)) {
        return {
          success: false,
          error: `Dependencies for task "${task.id}" must be an array.`
        };
      }

      normalized.push({
        id: task.id,
        title: task.title.trim(),
        description: task.description || '',
        dependencies: [...dependencies],
        assignedAgent: task.assignedAgent || null,
        status: 'pending',
        result: null,
        createdAt: Date.now(),
        completedAt: null
      });
    }

    for (const task of normalized) {
      for (const dependency of task.dependencies) {
        if (!ids.has(dependency)) {
          return {
            success: false,
            error: `Task "${task.id}" references unknown dependency "${dependency}".`
          };
        }

        if (dependency === task.id) {
          return {
            success: false,
            error: `Task "${task.id}" cannot depend on itself.`
          };
        }
      }
    }

    if (this.hasCycle(normalized)) {
      return {
        success: false,
        error: 'Workflow contains a dependency cycle.'
      };
    }

    const plan = {
      id: randomUUID(),
      title: title.trim(),
      status: 'pending',
      tasks: normalized,
      executionOrder: this.getExecutionOrder(normalized),
      metadata,
      createdAt: Date.now(),
      startedAt: null,
      completedAt: null
    };

    this.plans.set(plan.id, plan);

    return {
      success: true,
      plan
    };
  }

  hasCycle(tasks) {
    const taskMap = new Map(
      tasks.map(task => [task.id, task])
    );

    const visited = new Set();
    const visiting = new Set();

    const visit = id => {
      if (visiting.has(id)) return true;
      if (visited.has(id)) return false;

      visiting.add(id);

      const task = taskMap.get(id);

      for (const dependency of task.dependencies) {
        if (visit(dependency)) return true;
      }

      visiting.delete(id);
      visited.add(id);

      return false;
    };

    for (const task of tasks) {
      if (visit(task.id)) return true;
    }

    return false;
  }

  getExecutionOrder(tasks) {
    const taskMap = new Map(
      tasks.map(task => [task.id, task])
    );

    const remaining = new Set(
      tasks.map(task => task.id)
    );

    const order = [];

    while (remaining.size > 0) {
      const ready = [...remaining].filter(id =>
        taskMap.get(id).dependencies.every(
          dependency => !remaining.has(dependency)
        )
      );

      if (ready.length === 0) {
        return [];
      }

      order.push(ready);

      for (const id of ready) {
        remaining.delete(id);
      }
    }

    return order;
  }

  startPlan(planId) {
    const plan = this.getPlan(planId);

    if (!plan) {
      return {
        success: false,
        error: 'Plan not found.'
      };
    }

    if (plan.status !== 'pending') {
      return {
        success: false,
        error: `Cannot start plan in "${plan.status}" status.`
      };
    }

    plan.status = 'running';
    plan.startedAt = Date.now();

    return {
      success: true,
      plan
    };
  }

  getReadyTasks(planId) {
    const plan = this.getPlan(planId);

    if (!plan || plan.status !== 'running') {
      return [];
    }

    return plan.tasks.filter(task =>
      task.status === 'pending' &&
      task.dependencies.every(dependency =>
        plan.tasks.some(
          item =>
            item.id === dependency &&
            item.status === 'completed'
        )
      )
    );
  }

  startTask(planId, taskId) {
    const plan = this.getPlan(planId);

    if (!plan || plan.status !== 'running') {
      return {
        success: false,
        error: 'Plan is not running.'
      };
    }

    const task = plan.tasks.find(
      item => item.id === taskId
    );

    if (!task) {
      return {
        success: false,
        error: 'Task not found.'
      };
    }

    if (task.status !== 'pending') {
      return {
        success: false,
        error: 'Task is not pending.'
      };
    }

    const ready = this.getReadyTasks(planId);

    if (!ready.some(item => item.id === taskId)) {
      return {
        success: false,
        error: 'Task dependencies are not completed.'
      };
    }

    task.status = 'running';
    task.startedAt = Date.now();

    return {
      success: true,
      task
    };
  }

  completeTask(planId, taskId, result = null) {
    const plan = this.getPlan(planId);

    if (!plan || plan.status !== 'running') {
      return {
        success: false,
        error: 'Plan is not running.'
      };
    }

    const task = plan.tasks.find(
      item => item.id === taskId
    );

    if (!task || task.status !== 'running') {
      return {
        success: false,
        error: 'Task is not running.'
      };
    }

    task.status = 'completed';
    task.result = result;
    task.completedAt = Date.now();

    if (plan.tasks.every(item => item.status === 'completed')) {
      plan.status = 'completed';
      plan.completedAt = Date.now();
    }

    return {
      success: true,
      task,
      plan
    };
  }

  failTask(planId, taskId, error) {
    const plan = this.getPlan(planId);

    if (!plan || plan.status !== 'running') {
      return {
        success: false,
        error: 'Plan is not running.'
      };
    }

    const task = plan.tasks.find(
      item => item.id === taskId
    );

    if (!task || task.status !== 'running') {
      return {
        success: false,
        error: 'Task is not running.'
      };
    }

    task.status = 'failed';
    task.error = error instanceof Error
      ? error.message
      : String(error || 'Task failed.');

    task.completedAt = Date.now();
    plan.status = 'failed';

    return {
      success: true,
      task,
      plan
    };
  }

  getPlan(planId) {
    return this.plans.get(planId) || null;
  }

  getPlans({
    status
  } = {}) {
    let plans = [...this.plans.values()];

    if (status) {
      plans = plans.filter(
        plan => plan.status === status
      );
    }

    return plans;
  }

  getProgress(planId) {
    const plan = this.getPlan(planId);

    if (!plan) return null;

    const total = plan.tasks.length;
    const completed = plan.tasks.filter(
      task => task.status === 'completed'
    ).length;

    const running = plan.tasks.filter(
      task => task.status === 'running'
    ).length;

    const failed = plan.tasks.filter(
      task => task.status === 'failed'
    ).length;

    return {
      planId,
      total,
      completed,
      running,
      failed,
      pending: total - completed - running - failed,
      percentage: total === 0
        ? 0
        : Math.round((completed / total) * 100)
    };
  }

  removePlan(planId) {
    return {
      success: this.plans.delete(planId)
    };
  }

  getStats() {
    const plans = [...this.plans.values()];

    return {
      totalPlans: plans.length,
      pending: plans.filter(plan => plan.status === 'pending').length,
      running: plans.filter(plan => plan.status === 'running').length,
      completed: plans.filter(plan => plan.status === 'completed').length,
      failed: plans.filter(plan => plan.status === 'failed').length,
      totalTasks: plans.reduce(
        (total, plan) => total + plan.tasks.length,
        0
      )
    };
  }
}

module.exports = AgentWorkflowPlanner;
    


'use strict';

const { randomUUID } = require('node:crypto');

class AgentCollaborationCoordinator {
  constructor(options = {}) {
    this.maxTasks = options.maxTasks ?? 500;
    this.maxHistory = options.maxHistory ?? 1000;

    this.tasks = new Map();
    this.history = [];
  }

  createTask({
    title,
    description = '',
    agents = [],
    metadata = {}
  } = {}) {
    if (
      typeof title !== 'string' ||
      !title.trim()
    ) {
      return {
        success: false,
        error: 'Task title is required.'
      };
    }

    if (!Array.isArray(agents) || agents.length === 0) {
      return {
        success: false,
        error: 'At least one collaborating agent is required.'
      };
    }

    if (this.tasks.size >= this.maxTasks) {
      return {
        success: false,
        error: 'Task capacity reached.'
      };
    }

    const uniqueAgents = [...new Set(agents)];

    if (
      uniqueAgents.some(
        agent =>
          typeof agent !== 'string' ||
          !agent.trim()
      )
    ) {
      return {
        success: false,
        error: 'Invalid agent identifier.'
      };
    }

    const task = {
      id: randomUUID(),
      title: title.trim(),
      description,
      status: 'pending',
      agents: uniqueAgents.map(agent => ({
        id: agent,
        status: 'assigned',
        result: null,
        error: null,
        assignedAt: Date.now(),
        completedAt: null
      })),
      results: [],
      metadata,
      createdAt: Date.now(),
      completedAt: null
    };

    this.tasks.set(task.id, task);
    this.record('task_created', task.id, {
      title: task.title,
      agents: uniqueAgents
    });

    return {
      success: true,
      task
    };
  }

  startTask(taskId) {
    const task = this.getTask(taskId);

    if (!task) {
      return {
        success: false,
        error: 'Task not found.'
      };
    }

    if (task.status !== 'pending') {
      return {
        success: false,
        error: `Cannot start task in "${task.status}" status.`
      };
    }

    task.status = 'running';
    task.startedAt = Date.now();

    this.record('task_started', taskId);

    return {
      success: true,
      task
    };
  }

  submitResult(taskId, agentId, result) {
    const task = this.getTask(taskId);

    if (!task) {
      return {
        success: false,
        error: 'Task not found.'
      };
    }

    if (task.status !== 'running') {
      return {
        success: false,
        error: 'Task is not running.'
      };
    }

    const agent = task.agents.find(
      item => item.id === agentId
    );

    if (!agent) {
      return {
        success: false,
        error: 'Agent is not assigned to this task.'
      };
    }

    if (agent.status !== 'assigned') {
      return {
        success: false,
        error: 'Agent has already submitted or failed.'
      };
    }

    agent.status = 'completed';
    agent.result = result;
    agent.completedAt = Date.now();

    task.results.push({
      agentId,
      result,
      submittedAt: Date.now()
    });

    this.record('result_submitted', taskId, {
      agentId
    });

    return {
      success: true,
      task,
      result
    };
  }

  failAgent(taskId, agentId, error) {
    const task = this.getTask(taskId);

    if (!task) {
      return {
        success: false,
        error: 'Task not found.'
      };
    }

    if (task.status !== 'running') {
      return {
        success: false,
        error: 'Task is not running.'
      };
    }

    const agent = task.agents.find(
      item => item.id === agentId
    );

    if (!agent) {
      return {
        success: false,
        error: 'Agent is not assigned to this task.'
      };
    }

    if (agent.status !== 'assigned') {
      return {
        success: false,
        error: 'Agent is no longer active on this task.'
      };
    }

    agent.status = 'failed';
    agent.error = error instanceof Error
      ? error.message
      : String(error || 'Agent failed.');

    agent.completedAt = Date.now();

    this.record('agent_failed', taskId, {
      agentId,
      error: agent.error
    });

    return {
      success: true,
      task,
      agent
    };
  }

  completeTask(taskId, options = {}) {
    const task = this.getTask(taskId);

    if (!task) {
      return {
        success: false,
      error: 'Task not found.'
      };
    }

    if (task.status !== 'running') {
      return {
        success: false,
        error: 'Task is not running.'
      };
    }

    const allowPartial = options.allowPartial === true;

    const pendingAgents = task.agents.filter(
      agent => agent.status === 'assigned'
    );

    const failedAgents = task.agents.filter(
      agent => agent.status === 'failed'
    );

    const completedAgents = task.agents.filter(
      agent => agent.status === 'completed'
    );

    if (pendingAgents.length > 0) {
      return {
        success: false,
        error: 'Some agents have not finished.',
        pending: pendingAgents.map(agent => agent.id)
      };
    }

    if (
      failedAgents.length > 0 &&
      !allowPartial
    ) {
      task.status = 'failed';
      task.completedAt = Date.now();

      this.record('task_failed', taskId, {
        failedAgents: failedAgents.map(agent => agent.id)
      });

      return {
        success: false,
        error: 'Collaboration failed because one or more agents failed.',
        task
      };
    }

    if (completedAgents.length === 0) {
      task.status = 'failed';
      task.completedAt = Date.now();

      this.record('task_failed', taskId, {
        reason: 'no_results'
      });

      return {
        success: false,
        error: 'No agent produced a result.',
        task
      };
    }

    task.status = failedAgents.length > 0
      ? 'completed_partial'
      : 'completed';

    task.completedAt = Date.now();

    this.record('task_completed', taskId, {
      status: task.status,
      completedAgents: completedAgents.map(agent => agent.id),
      failedAgents: failedAgents.map(agent => agent.id)
    });

    return {
      success: true,
      task,
      results: task.results,
      partial: failedAgents.length > 0
    };
  }

  getTask(taskId) {
    return this.tasks.get(taskId) || null;
  }

  getTasks({
    status,
    agentId
  } = {}) {
    let tasks = [...this.tasks.values()];

    if (status) {
      tasks = tasks.filter(
        task => task.status === status
      );
    }

    if (agentId) {
      tasks = tasks.filter(
        task =>
          task.agents.some(agent => agent.id === agentId)
      );
    }

    return tasks;
  }

  record(type, taskId, details = {}) {
    this.history.push({
      id: randomUUID(),
      type,
      taskId,
      details,
      timestamp: Date.now()
    });

    if (this.history.length > this.maxHistory) {
      this.history.splice(
        0,
        this.history.length - this.maxHistory
      );
    }
  }

  getHistory({
    taskId,
    limit = 100
  } = {}) {
    let history = [...this.history];

    if (taskId) {
      history = history.filter(
        item => item.taskId === taskId
      );
    }

    const safeLimit = Math.max(
      0,
      Math.min(Number(limit) || 0, this.maxHistory)
    );

    return history.slice(-safeLimit);
  }

  getStats() {
    const tasks = [...this.tasks.values()];

    return {
      totalTasks: tasks.length,
      pending: tasks.filter(task => task.status === 'pending').length,
      running: tasks.filter(task => task.status === 'running').length,
      completed: tasks.filter(task => task.status === 'completed').length,
      partiallyCompleted: tasks.filter(task => task.status === 'completed_partial').length,
      failed: tasks.filter(task => task.status === 'failed').length,
      totalResults: tasks.reduce(
        (total, task) => total + task.results.length,
        0
      ),
      historyEntries: this.history.length
    };
  }

  removeTask(taskId) {
    const removed = this.tasks.delete(taskId);

    return {
      success: removed
    };
  }

  clearHistory() {
    this.history = [];

    return {
      success: true
    };
  }
}

module.exports = AgentCollaborationCoordinator;
                

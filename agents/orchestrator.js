
'use strict';

/**
 * StoryForge Multi-Agent Orchestrator
 * Collection 6 - Day 1
 *
 * Node.js 18+
 * CommonJS
 *
 * Responsibilities:
 * - Agent registry
 * - Dependency-aware task scheduling
 * - Concurrent execution
 * - Retries
 * - Task timeouts
 * - Workflow state tracking
 * - Duplicate workflow protection (in-process)
 * - Results aggregation
 *
 * This module does not call an AI provider itself.
 * Agents supply their own execution functions.
 */

const crypto = require('crypto');

class StoryForgeOrchestrator {
  constructor(options = {}) {
    this.maxConcurrency = Math.max(
      1,
      Number(options.maxConcurrency || 3)
    );

    this.defaultTimeoutMs = Math.max(
      1000,
      Number(options.defaultTimeoutMs || 60000)
    );

    this.defaultRetries = Math.max(
      0,
      Number(options.defaultRetries ?? 1)
    );

    this.agents = new Map();
    this.workflows = new Map();
    this.activeWorkflowKeys = new Map();
  }

  // -----------------------------
  // Agent registration
  // -----------------------------

  registerAgent(name, handler, options = {}) {
    if (!name || typeof name !== 'string') {
      throw new Error('Agent name is required.');
    }

    if (typeof handler !== 'function') {
      throw new Error(`Handler for "${name}" must be a function.`);
    }

    if (this.agents.has(name)) {
      throw new Error(`Agent "${name}" is already registered.`);
    }

    this.agents.set(name, {
      name,
      handler,
      description: options.description || '',
      enabled: options.enabled !== false,
      timeoutMs: options.timeoutMs || this.defaultTimeoutMs,
      retries: options.retries ?? this.defaultRetries
    });

    return this;
  }

  unregisterAgent(name) {
    return this.agents.delete(name);
  }

  getAgents() {
    return Array.from(this.agents.values()).map(agent => ({
      name: agent.name,
      description: agent.description,
      enabled: agent.enabled,
      timeoutMs: agent.timeoutMs,
      retries: agent.retries
    }));
  }

  // -----------------------------
  // Workflow utilities
  // -----------------------------

  createWorkflow(tasks, options = {}) {
    if (!Array.isArray(tasks) || tasks.length === 0) {
      throw new Error('Workflow must contain at least one task.');
    }

    const workflowId = crypto.randomUUID();

    const normalized = tasks.map((task, index) => {
      if (!task.id || !task.agent) {
        throw new Error(
          `Task ${index} must have an id and agent name.`
        );
      }

      return {
        id: String(task.id),
        agent: String(task.agent),
        input: task.input ?? {},
        dependsOn: Array.isArray(task.dependsOn)
          ? task.dependsOn.map(String)
          : [],
        retries: task.retries,
        timeoutMs: task.timeoutMs,
        status: 'pending',
        attempts: 0,
        result: null,
        error: null,
        startedAt: null,
        completedAt: null
      };
    });

    this.validateTasks(normalized);

    const workflow = {
      id: workflowId,
      key: options.key || null,
      status: 'pending',
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      tasks: normalized,
      input: options.input ?? {},
      output: null,
      error: null
    };

    this.workflows.set(workflowId, workflow);

    if (workflow.key) {
      this.activeWorkflowKeys.set(workflow.key, workflowId);
    }

    return workflowId;
  }

  validateTasks(tasks) {
    const ids = new Set(tasks.map(task => task.id));

    if (ids.size !== tasks.length) {
      throw new Error('Task IDs must be unique.');
    }

    for (const task of tasks) {
      for (const dependency of task.dependsOn) {
        if (!ids.has(dependency)) {
          throw new Error(
            `Task "${task.id}" depends on unknown task "${dependency}".`
          );
        }

        if (dependency === task.id) {
          throw new Error(
            `Task "${task.id}" cannot depend on itself.`
          );
        }
      }
    }

    // Detect dependency cycles
    const visited = new Set();
    const visiting = new Set();

    const visit = id => {
      if (visiting.has(id)) {
        throw new Error('Workflow contains a dependency cycle.');
      }

      if (visited.has(id)) return;

      visiting.add(id);

      const task = tasks.find(item => item.id === id);

      for (const dependency of task.dependsOn) {
        visit(dependency);
      }

      visiting.delete(id);
      visited.add(id);
    };

    for (const task of tasks) {
      visit(task.id);
    }
  }

  // -----------------------------
  // Workflow execution
  // -----------------------------

  async runWorkflow(workflowId) {
    const workflow = this.workflows.get(workflowId);

    if (!workflow) {
      throw new Error('Workflow not found.');
    }

    if (workflow.status !== 'pending') {
      throw new Error(
        `Workflow cannot start from status "${workflow.status}".`
      );
    }

    workflow.status = 'running';
    workflow.startedAt = new Date().toISOString();

    try {
      await this.scheduleTasks(workflow);

      const failed = workflow.tasks.some(
        task => task.status === 'failed'
      );

      workflow.status = failed ? 'failed' : 'completed';

      workflow.output = this.buildOutput(workflow);
    } catch (error) {
      workflow.status = 'failed';
      workflow.error = error.message;
    } finally {
      workflow.completedAt = new Date().toISOString();

      if (workflow.key) {
        this.activeWorkflowKeys.delete(workflow.key);
      }
    }

    return this.getWorkflow(workflowId);
  }

  async scheduleTasks(workflow) {
    const running = new Set();

    while (true) {
      const pending = workflow.tasks.filter(
        task => task.status === 'pending'
      );

      if (pending.length === 0 && running.size === 0) {
        break;
      }

      // Mark tasks blocked by failed dependencies.
      for (const task of pending) {
        const dependencies = task.dependsOn.map(id =>
          workflow.tasks.find(item => item.id === id)
        );

        if (dependencies.some(dep => dep.status === 'failed')) {
          task.status = 'skipped';
          task.error = 'A dependency failed.';
          task.completedAt = new Date().toISOString();
        }
      }

      const ready = workflow.tasks.filter(task => {
        if (task.status !== 'pending') return false;

        return task.dependsOn.every(id => {
          const dependency = workflow.tasks.find(
            item => item.id === id
          );

          return dependency && dependency.status === 'completed';
        });
      });

      while (
        ready.length > 0 &&
        running.size < this.maxConcurrency
      ) {
        const task = ready.shift();

        task.status = 'running';

        const promise = this.executeTask(workflow, task)
          .finally(() => running.delete(task.id));

        running.add(task.id);
      }

      if (running.size > 0) {
        await Promise.race(Array.from(running.values()));
        continue;
      }

      const remaining = workflow.tasks.filter(
        task => task.status === 'pending'
      );

      if (remaining.length > 0) {
        throw new Error(
          'Workflow stalled. Check task dependencies or agent availability.'
        );
      }

      break;
    }
  }

  // -----------------------------
  // Agent execution
  // -----------------------------

  async executeTask(workflow, task) {
    const agent = this.agents.get(task.agent);

    if (!agent || !agent.enabled) {
      task.status = 'failed';
      task.error = `Agent "${task.agent}" is unavailable.`;
      task.completedAt = new Date().toISOString();
      return;
    }

    const maxRetries = task.retries ?? agent.retries;
    const timeoutMs = task.timeoutMs ?? agent.timeoutMs;

    task.startedAt = new Date().toISOString();

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      task.attempts++;

      try {
        const dependencyResults = {};

        for (const dependencyId of task.dependsOn) {
          const dependency = workflow.tasks.find(
            item => item.id === dependencyId
          );

          dependencyResults[dependencyId] = dependency.result;
        }

        const context = {
          workflowId: workflow.id,
          taskId: task.id,
          agentName: agent.name,
          workflowInput: workflow.input,
          taskInput: task.input,
          dependencyResults,
          attempt: task.attempts
        };

        const controller = new AbortController();

        const timeout = setTimeout(() => {
          controller.abort();
        }, timeoutMs);

        try {
          const result = await Promise.race([
            Promise.resolve().then(() =>
              agent.handler(context, {
                signal: controller.signal
              })
            ),
            new Promise((_, reject) => {
              controller.signal.addEventListener(
                'abort',
                () => reject(
                  new Error(`Agent timed out after ${timeoutMs}ms.`)
                ),
                { once: true }
              );
            })
          ]);

          clearTimeout(timeout);

          task.result = result ?? null;
          task.status = 'completed';
          task.error = null;
          task.completedAt = new Date().toISOString();

          return;
        } catch (error) {
          clearTimeout(timeout);
          throw error;
        }
      } catch (error) {
        task.error = error.message || 'Agent execution failed.';

        if (attempt < maxRetries) {
          const delay = Math.min(
            1000 * Math.pow(2, attempt),
            10000
          );

          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    task.status = 'failed';
    task.completedAt = new Date().toISOString();
  }

  // -----------------------------
  // Output aggregation
  // -----------------------------

  buildOutput(workflow) {
    const results = {};

    for (const task of workflow.tasks) {
      results[task.id] = {
        agent: task.agent,
        status: task.status,
        result: task.result,
        error: task.error
      };
    }

    return {
      workflowId: workflow.id,
      status: workflow.status,
      results
    };
  }

  // -----------------------------
  // Workflow inspection
  // -----------------------------

  getWorkflow(workflowId) {
    const workflow = this.workflows.get(workflowId);

    if (!workflow) return null;

    return JSON.parse(JSON.stringify(workflow));
  }

  listWorkflows() {
    return Array.from(this.workflows.values()).map(workflow => ({
      id: workflow.id,
      key: workflow.key,
      status: workflow.status,
      createdAt: workflow.createdAt,
      startedAt: workflow.startedAt,
      completedAt: workflow.completedAt,
      taskCount: workflow.tasks.length
    }));
  }

  // -----------------------------
  // Duplicate workflow protection
  // -----------------------------

  getActiveWorkflowByKey(key) {
    const workflowId = this.activeWorkflowKeys.get(key);

    if (!workflowId) return null;

    const workflow = this.workflows.get(workflowId);

    if (!workflow || workflow.status !== 'running') {
      this.activeWorkflowKeys.delete(key);
      return null;
    }

    return this.getWorkflow(workflowId);
  }
}

module.exports = { StoryForgeOrchestrator };
      

'use strict';

const { randomUUID } = require('node:crypto');

class AgentTaskRouter {
  constructor(options = {}) {
    this.maxAgents = options.maxAgents ?? 500;
    this.maxAssignments = options.maxAssignments ?? 5000;

    this.agents = new Map();
    this.assignments = new Map();
  }

  registerAgent({
    id,
    name,
    capabilities = [],
    maxConcurrentTasks = 1,
    metadata = {}
  } = {}) {
    if (typeof id !== 'string' || !id.trim()) {
      return { success: false, error: 'Agent ID is required.' };
    }

    if (typeof name !== 'string' || !name.trim()) {
      return { success: false, error: 'Agent name is required.' };
    }

    if (!Array.isArray(capabilities)) {
      return { success: false, error: 'Capabilities must be an array.' };
    }

    if (
      !Number.isInteger(maxConcurrentTasks) ||
      maxConcurrentTasks < 1
    ) {
      return {
        success: false,
        error: 'maxConcurrentTasks must be a positive integer.'
      };
    }

    if (this.agents.has(id)) {
      return { success: false, error: 'Agent already registered.' };
    }

    if (this.agents.size >= this.maxAgents) {
      return { success: false, error: 'Agent capacity reached.' };
    }

    const normalizedCapabilities = [
      ...new Set(
        capabilities
          .filter(item => typeof item === 'string' && item.trim())
          .map(item => item.trim().toLowerCase())
      )
    ];

    const agent = {
      id,
      name: name.trim(),
      capabilities: normalizedCapabilities,
      maxConcurrentTasks,
      available: true,
      metadata,
      registeredAt: Date.now()
    };

    this.agents.set(id, agent);

    return { success: true, agent };
  }

  unregisterAgent(agentId) {
    const agent = this.agents.get(agentId);

    if (!agent) {
      return { success: false, error: 'Agent not found.' };
    }

    const active = this.getActiveAssignments(agentId);

    if (active.length > 0) {
      return {
        success: false,
        error: 'Cannot unregister agent with active assignments.'
      };
    }

    this.agents.delete(agentId);

    return { success: true, agent };
  }

  setAgentAvailability(agentId, available) {
    const agent = this.agents.get(agentId);

    if (!agent) {
      return { success: false, error: 'Agent not found.' };
    }

    if (typeof available !== 'boolean') {
      return {
        success: false,
        error: 'Availability must be a boolean.'
      };
    }

    agent.available = available;

    return {
      success: true,
      agent
    };
  }

  getActiveAssignments(agentId) {
    return [...this.assignments.values()].filter(
      assignment =>
        assignment.agentId === agentId &&
        assignment.status === 'assigned'
    );
  }

  getAgentLoad(agentId) {
    return this.getActiveAssignments(agentId).length;
  }

  getEligibleAgents(requiredCapabilities = []) {
    if (!Array.isArray(requiredCapabilities)) {
      return [];
    }

    const required = requiredCapabilities.map(
      capability => String(capability).trim().toLowerCase()
    );

    return [...this.agents.values()].filter(agent => {
      if (!agent.available) return false;

      if (
        this.getAgentLoad(agent.id) >= agent.maxConcurrentTasks
      ) {
        return false;
      }

      return required.every(
        capability => agent.capabilities.includes(capability)
      );
    });
  }

  assignTask({
    taskId,
    title,
    requiredCapabilities = [],
    priority = 0,
    metadata = {}
  } = {}) {
    if (typeof taskId !== 'string' || !taskId.trim()) {
      return { success: false, error: 'Task ID is required.' };
    }

    if (typeof title !== 'string' || !title.trim()) {
      return { success: false, error: 'Task title is required.' };
    }

    if (!Array.isArray(requiredCapabilities)) {
      return {
        success: false,
        error: 'Required capabilities must be an array.'
      };
    }

    if (!Number.isFinite(priority)) {
      return {
        success: false,
        error: 'Priority must be a finite number.'
      };
    }

    if (this.assignments.has(taskId)) {
      return {
        success: false,
        error: 'Task already has an assignment record.'
      };
    }

    if (this.assignments.size >= this.maxAssignments) {
      return {
        success: false,
        error: 'Assignment capacity reached.'
      };
    }

    const required = [
      ...new Set(
        requiredCapabilities
          .filter(item => typeof item === 'string' && item.trim())
          .map(item => item.trim().toLowerCase())
      )
    ];

    const eligible = this.getEligibleAgents(required);

    if (eligible.length === 0) {
      return {
        success: false,
        error: 'No available agent matches the required capabilities.'
      };
    }

    eligible.sort((a, b) => {
      const loadA = this.getAgentLoad(a.id);
      const loadB = this.getAgentLoad(b.id);

      if (loadA !== loadB) return loadA - loadB;

      return a.id.localeCompare(b.id);
    });

    const selected = eligible[0];

    const assignment = {
      id: randomUUID(),
      taskId,
      title: title.trim(),
      agentId: selected.id,
      agentName: selected.name,
      requiredCapabilities: required,
      priority,
      status: 'assigned',
      metadata,
      assignedAt: Date.now(),
      completedAt: null,
      result: null,
      error: null
    };

    this.assignments.set(taskId, assignment);

    return {
      success: true,
      assignment,
      agent: selected
    };
  }

  completeAssignment(taskId, result = null) {
    const assignment = this.assignments.get(taskId);

    if (!assignment) {
      return { success: false, error: 'Assignment not found.' };
    }

    if (assignment.status !== 'assigned') {
      return {
        success: false,
        error: 'Assignment is not active.'
      };
    }

    assignment.status = 'completed';
    assignment.result = result;
    assignment.completedAt = Date.now();

    return { success: true, assignment };
  }

  failAssignment(taskId, error) {
    const assignment = this.assignments.get(taskId);

    if (!assignment) {
      return { success: false, error: 'Assignment not found.' };
    }

    if (assignment.status !== 'assigned') {
      return {
        success: false,
        error: 'Assignment is not active.'
      };
    }

    assignment.status = 'failed';
    assignment.error = error instanceof Error
      ? error.message
      : String(error || 'Task failed.');

    assignment.completedAt = Date.now();

    return { success: true, assignment };
  }

  reassignTask(taskId) {
    const assignment = this.assignments.get(taskId);

    if (!assignment) {
      return { success: false, error: 'Assignment not found.' };
    }

    if (assignment.status !== 'assigned') {
      return {
        success: false,
        error: 'Only active assignments can be reassigned.'
      };
    }

    const previousAgentId = assignment.agentId;
    const previousAgent = this.agents.get(previousAgentId);

    if (previousAgent) {
      previousAgent.available = false;
    }

    assignment.status = 'failed';
    assignment.error = 'Assignment superseded by reassignment.';
    assignment.completedAt = Date.now();

    const result = this.assignTask({
      taskId: `${taskId}::reassignment::${randomUUID()}`,
      title: assignment.title,
      requiredCapabilities: assignment.requiredCapabilities,
      priority: assignment.priority,
      metadata: {
        ...assignment.metadata,
        reassignedFrom: taskId,
        previousAgentId
      }
    });

    if (!result.success) {
      assignment.status = 'assigned';
      assignment.error = null;
      assignment.completedAt = null;

      if (previousAgent) {
        previousAgent.available = true;
      }

      return {
        success: false,
        error: result.error,
        originalAssignment: assignment
      };
    }

    return {
      success: true,
      previousAssignment: assignment,
      newAssignment: result.assignment,
      newAgent: result.agent
    };
  }

  getAgent(agentId) {
    const agent = this.agents.get(agentId);

    if (!agent) return null;

    return {
      ...agent,
      currentLoad: this.getAgentLoad(agentId)
    };
  }

  getAgents({
    available,
    capability
  } = {}) {
    let agents = [...this.agents.values()];

    if (typeof available === 'boolean') {
      agents = agents.filter(agent => agent.available === available);
    }

    if (capability) {
      const normalized = String(capability).trim().toLowerCase();

      agents = agents.filter(
        agent => agent.capabilities.includes(normalized)
      );
    }

    return agents.map(agent => ({
      ...agent,
      currentLoad: this.getAgentLoad(agent.id)
    }));
  }

  getAssignment(taskId) {
    return this.assignments.get(taskId) || null;
  }

  getAssignments({
    agentId,
    status
  } = {}) {
    let assignments = [...this.assignments.values()];

    if (agentId) {
      assignments = assignments.filter(
        assignment => assignment.agentId === agentId
      );
    }

    if (status) {
      assignments = assignments.filter(
        assignment => assignment.status === status
      );
    }

    return assignments;
  }

  getStats() {
    const assignments = [...this.assignments.values()];

    return {
      totalAgents: this.agents.size,
      availableAgents: [...this.agents.values()].filter(
        agent => agent.available
      ).length,
      unavailableAgents: [...this.agents.values()].filter(
        agent => !agent.available
      ).length,
      totalAssignments: assignments.length,
      activeAssignments: assignments.filter(
        assignment => assignment.status === 'assigned'
      ).length,
      completedAssignments: assignments.filter(
        assignment => assignment.status === 'completed'
      ).length,
      failedAssignments: assignments.filter(
        assignment => assignment.status === 'failed'
      ).length
    };
  }
}

module.exports = AgentTaskRouter;


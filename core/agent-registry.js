
'use strict';

class AgentRegistry {
  constructor() {
    this.agents = new Map();
  }

  register(id, agent) {
    if (!id || typeof id !== 'string') {
      throw new Error('Agent ID must be a non-empty string.');
    }

    if (!agent || typeof agent.run !== 'function') {
      throw new Error(`Agent "${id}" must provide a run() method.`);
    }

    if (this.agents.has(id)) {
      throw new Error(`Agent "${id}" is already registered.`);
    }

    const registeredAgent = {
      id,
      name: agent.name || id,
      description: agent.description || '',
      version: agent.version || '1.0.0',
      run: agent.run,
      registeredAt: Date.now()
    };

    this.agents.set(id, registeredAgent);

    return registeredAgent;
  }

  get(id) {
    return this.agents.get(id) || null;
  }

  has(id) {
    return this.agents.has(id);
  }

  list() {
    return Array.from(this.agents.values()).map(agent => ({
      id: agent.id,
      name: agent.name,
      description: agent.description,
      version: agent.version,
      registeredAt: agent.registeredAt
    }));
  }

  unregister(id) {
    return this.agents.delete(id);
  }

  clear() {
    this.agents.clear();
  }

  get count() {
    return this.agents.size;
  }
}

module.exports = AgentRegistry;

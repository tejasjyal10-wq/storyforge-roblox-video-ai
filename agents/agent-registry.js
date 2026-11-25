
'use strict';

/**
 * StoryForge Agent Registry
 * Collection 6 - Day 2
 *
 * Responsibilities:
 * - Agent registration and unique IDs
 * - Agent capability discovery
 * - Agent lookup
 * - Enable / disable lifecycle
 * - Agent updates
 * - Safe agent removal
 * - Registry inspection
 *
 * This module manages agents; it does not call AI providers.
 */

class AgentRegistry {
  constructor() {
    this.agents = new Map();
  }

  // -----------------------------
  // Registration
  // -----------------------------

  register(agent) {
    if (!agent || typeof agent !== 'object') {
      throw new Error('Agent definition is required.');
    }

    const id = String(agent.id || '').trim();
    const name = String(agent.name || '').trim();

    if (!id) {
      throw new Error('Agent ID is required.');
    }

    if (!name) {
      throw new Error('Agent name is required.');
    }

    if (this.agents.has(id)) {
      throw new Error(`Agent "${id}" is already registered.`);
    }

    if (typeof agent.handler !== 'function') {
      throw new Error(`Agent "${id}" must have a handler function.`);
    }

    const capabilities = Array.isArray(agent.capabilities)
      ? [...new Set(
          agent.capabilities
            .map(value => String(value).trim())
            .filter(Boolean)
        )]
      : [];

    const record = {
      id,
      name,
      description: String(agent.description || ''),
      capabilities,
      handler: agent.handler,
      enabled: agent.enabled !== false,
      metadata: agent.metadata || {},
      registeredAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.agents.set(id, record);

    return this.getAgent(id);
  }

  // -----------------------------
  // Lookup
  // -----------------------------

  has(id) {
    return this.agents.has(String(id));
  }

  getAgent(id) {
    const agent = this.agents.get(String(id));

    if (!agent) return null;

    return {
      ...agent,
      capabilities: [...agent.capabilities],
      metadata: { ...agent.metadata }
    };
  }

  getHandler(id) {
    const agent = this.agents.get(String(id));

    if (!agent || !agent.enabled) {
      return null;
    }

    return agent.handler;
  }

  getAgents(options = {}) {
    const { enabledOnly = false } = options;

    return Array.from(this.agents.values())
      .filter(agent => !enabledOnly || agent.enabled)
      .map(agent => ({
        id: agent.id,
        name: agent.name,
        description: agent.description,
        capabilities: [...agent.capabilities],
        enabled: agent.enabled,
        metadata: { ...agent.metadata },
        registeredAt: agent.registeredAt,
        updatedAt: agent.updatedAt
      }));
  }

  findByCapability(capability, options = {}) {
    const target = String(capability || '').trim().toLowerCase();

    if (!target) return [];

    return this.getAgents(options).filter(agent =>
      agent.capabilities.some(
        item => item.toLowerCase() === target
      )
    );
  }

  // -----------------------------
  // Lifecycle
  // -----------------------------

  enable(id) {
    const agent = this.agents.get(String(id));

    if (!agent) {
      throw new Error(`Agent "${id}" not found.`);
    }

    agent.enabled = true;
    agent.updatedAt = new Date().toISOString();

    return this.getAgent(id);
  }

  disable(id) {
    const agent = this.agents.get(String(id));

    if (!agent) {
      throw new Error(`Agent "${id}" not found.`);
    }

    agent.enabled = false;
    agent.updatedAt = new Date().toISOString();

    return this.getAgent(id);
  }

  update(id, changes = {}) {
    const agent = this.agents.get(String(id));

    if (!agent) {
      throw new Error(`Agent "${id}" not found.`);
    }

    if (changes.name !== undefined) {
      const name = String(changes.name).trim();

      if (!name) {
        throw new Error('Agent name cannot be empty.');
      }

      agent.name = name;
    }

    if (changes.description !== undefined) {
      agent.description = String(changes.description);
    }

    if (changes.capabilities !== undefined) {
      if (!Array.isArray(changes.capabilities)) {
        throw new Error('Capabilities must be an array.');
      }

      agent.capabilities = [
        ...new Set(
          changes.capabilities
            .map(value => String(value).trim())
            .filter(Boolean)
        )
      ];
    }

    if (changes.metadata !== undefined) {
      if (
        !changes.metadata ||
        typeof changes.metadata !== 'object' ||
        Array.isArray(changes.metadata)
      ) {
        throw new Error('Metadata must be an object.');
      }

      agent.metadata = {
        ...agent.metadata,
        ...changes.metadata
      };
    }

    if (changes.handler !== undefined) {
      if (typeof changes.handler !== 'function') {
        throw new Error('Agent handler must be a function.');
      }

      agent.handler = changes.handler;
    }

    if (changes.enabled !== undefined) {
      agent.enabled = Boolean(changes.enabled);
    }

    agent.updatedAt = new Date().toISOString();

    return this.getAgent(id);
  }

  unregister(id) {
    const key = String(id);

    if (!this.agents.has(key)) {
      return false;
    }

    return this.agents.delete(key);
  }

  // -----------------------------
  // Registry statistics
  // -----------------------------

  getStats() {
    const agents = Array.from(this.agents.values());

    return {
      total: agents.length,
      enabled: agents.filter(agent => agent.enabled).length,
      disabled: agents.filter(agent => !agent.enabled).length,
      capabilities: [
        ...new Set(agents.flatMap(agent => agent.capabilities))
      ].sort()
    };
  }
}

module.exports = { AgentRegistry };
  

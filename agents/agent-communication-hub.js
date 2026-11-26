
'use strict';

const { randomUUID } = require('node:crypto');

class AgentCommunicationHub {
  constructor(options = {}) {
    this.maxHistory = options.maxHistory ?? 1000;
    this.maxMessageSize = options.maxMessageSize ?? 100000;

    this.agents = new Map();
    this.history = [];
    this.pending = new Map();
  }

  registerAgent(agentId, handler) {
    if (
      typeof agentId !== 'string' ||
      !agentId.trim() ||
      typeof handler !== 'function'
    ) {
      return {
        success: false,
        error: 'Invalid agent registration.'
      };
    }

    this.agents.set(agentId, handler);

    return {
      success: true,
      agentId
    };
  }

  unregisterAgent(agentId) {
    const removed = this.agents.delete(agentId);

    return {
      success: removed,
      agentId
    };
  }

  createMessage({
    from,
    to,
    type = 'message',
    payload,
    priority = 'normal',
    correlationId = null
  }) {
    if (!from || !to) {
      return {
        success: false,
        error: 'Sender and recipient are required.'
      };
    }

    if (!['low', 'normal', 'high', 'critical'].includes(priority)) {
      return {
        success: false,
        error: 'Invalid message priority.'
      };
    }

    let serialized;

    try {
      serialized = JSON.stringify(payload);
    } catch {
      return {
        success: false,
        error: 'Message payload is not serializable.'
      };
    }

    if (
      serialized === undefined ||
      serialized.length > this.maxMessageSize
    ) {
      return {
        success: false,
        error: 'Message payload is empty or exceeds the size limit.'
      };
    }

    return {
      success: true,
      message: {
        id: randomUUID(),
        from,
        to,
        type,
        payload,
        priority,
        correlationId,
        timestamp: Date.now(),
        status: 'created'
      }
    };
  }

  record(message) {
    this.history.push({
      ...message,
      recordedAt: Date.now()
    });

    if (this.history.length > this.maxHistory) {
      this.history.splice(
        0,
        this.history.length - this.maxHistory
      );
    }
  }

  async send(messageData) {
    const created = this.createMessage(messageData);

    if (!created.success) {
      return created;
    }

    const message = created.message;
    const recipient = this.agents.get(message.to);

    if (!recipient) {
      message.status = 'undelivered';
      this.record(message);

      return {
        success: false,
        error: `Agent "${message.to}" is not registered.`,
        message
      };
    }

    message.status = 'delivering';
    this.record(message);

    try {
      const response = await recipient({
        ...message,
        receivedAt: Date.now()
      });

      message.status = 'delivered';

      const result = {
        success: true,
        message,
        response
      };

      this.record({
        ...message,
        response,
        status: 'delivered'
      });

      return result;
    } catch (error) {
      message.status = 'failed';

      this.record({
        ...message,
        error: error.message,
        status: 'failed'
      });

      return {
        success: false,
        error: error.message || 'Agent communication failed.',
        message
      };
    }
  }

  async broadcast({
    from,
    recipients,
    type = 'broadcast',
    payload,
    priority = 'normal'
  }) {
    if (!Array.isArray(recipients) || recipients.length === 0) {
      return {
        success: false,
        error: 'Recipients must be a non-empty array.'
      };
    }

    const results = await Promise.all(
      recipients.map(to =>
        this.send({
          from,
          to,
          type,
          payload,
          priority
        })
      )
    );

    return {
      success: results.every(result => result.success),
      total: results.length,
      delivered: results.filter(result => result.success).length,
      failed: results.filter(result => !result.success).length,
      results
    };
  }

  createRequest({
    from,
    to,
    type = 'request',
    payload,
    priority = 'normal'
  }) {
    const correlationId = randomUUID();

    return this.send({
      from,
      to,
      type,
      payload,
      priority,
      correlationId
    });
  }

  getHistory({
    agentId,
    limit = 100,
    type
  } = {}) {
    let results = [...this.history];

    if (agentId) {
      results = results.filter(
        message =>
          message.from === agentId ||
          message.to === agentId
      );
    }

    if (type) {
      results = results.filter(
        message => message.type === type
      );
    }

    const safeLimit = Math.max(
      0,
      Math.min(Number(limit) || 0, this.maxHistory)
    );

    return results.slice(-safeLimit);
  }

  getStats() {
    return {
      registeredAgents: this.agents.size,
      totalMessages: this.history.length,
      pendingRequests: this.pending.size,
      agents: [...this.agents.keys()]
    };
  }

  clearHistory() {
    this.history = [];

    return {
      success: true
    };
  }
}

module.exports = AgentCommunicationHub;
        

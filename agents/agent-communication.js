'use strict';

/**
 * StoryForge Agent Communication System
 * Collection 6 - Day 3
 *
 * Responsibilities:
 * - Agent-to-agent messaging
 * - Message routing
 * - Request/response handling
 * - Message validation
 * - Communication history
 * - Error handling
 */

class AgentCommunication {
  constructor(registry, options = {}) {
    if (!registry) {
      throw new Error('Agent registry is required.');
    }

    this.registry = registry;
    this.history = [];
    this.maxHistory = options.maxHistory || 1000;
  }

  createMessage(from, to, type, payload) {
    if (!from || !to) {
      throw new Error('Sender and receiver are required.');
    }

    if (!type) {
      throw new Error('Message type is required.');
    }

    return {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      from,
      to,
      type,
      payload,
      timestamp: new Date().toISOString()
    };
  }

  async send(from, to, type, payload) {
    if (!this.registry.has(from)) {
      throw new Error(`Sender agent "${from}" does not exist.`);
    }

    const receiver = this.registry.getAgent(to);

    if (!receiver) {
      throw new Error(`Receiver agent "${to}" does not exist.`);
    }

    if (!receiver.enabled) {
      throw new Error(`Receiver agent "${to}" is disabled.`);
    }

    const message = this.createMessage(from, to, type, payload);

    this.record(message, 'sent');

    try {
      const handler = this.registry.getHandler(to);

      const response = await handler({
        type: message.type,
        payload: message.payload,
        sender: message.from,
        messageId: message.id
      });

      this.record({
        ...message,
        response
      }, 'completed');

      return {
        success: true,
        message,
        response
      };
    } catch (error) {
      this.record({
        ...message,
        error: error.message
      }, 'failed');

      throw error;
    }
  }

  record(message, status) {
    this.history.push({
      message,
      status,
      recordedAt: new Date().toISOString()
    });

    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
  }

  getHistory(options = {}) {
    let records = [...this.history];

    if (options.agent) {
      records = records.filter(record =>
        record.message.from === options.agent ||
        record.message.to === options.agent
      );
    }

    if (options.status) {
      records = records.filter(record =>
        record.status === options.status
      );
    }

    if (options.limit) {
      records = records.slice(-options.limit);
    }

    return records;
  }

  clearHistory() {
    this.history = [];
  }

  getStats() {
    const total = this.history.length;

    return {
      total,
      sent: this.history.filter(r => r.status === 'sent').length,
      completed: this.history.filter(r => r.status === 'completed').length,
      failed: this.history.filter(r => r.status === 'failed').length
    };
  }
}

module.exports = { AgentCommunication };

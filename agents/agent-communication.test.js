'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { AgentRegistry } = require('./agent-registry');
const { AgentCommunication } = require('./agent-communication');

function createSetup() {
  const registry = new AgentRegistry();

  registry.register({
    id: 'story-director',
    name: 'Story Director',
    capabilities: ['story-planning'],
    handler: async message => ({
      received: true,
      sender: message.sender,
      payload: message.payload
    })
  });

  registry.register({
    id: 'scene-builder',
    name: 'Scene Builder',
    capabilities: ['scene-generation'],
    handler: async message => ({
      scene: 'Forest scene created',
      receivedPayload: message.payload
    })
  });

  registry.register({
    id: 'failing-agent',
    name: 'Failing Agent',
    capabilities: ['testing'],
    handler: async () => {
      throw new Error('Agent processing failed');
    }
  });

  return {
    registry,
    communication: new AgentCommunication(registry)
  };
}

// 1. Message creation
test('creates a valid message', () => {
  const { communication } = createSetup();

  const message = communication.createMessage(
    'story-director',
    'scene-builder',
    'scene-request',
    { location: 'forest' }
  );

  assert.equal(message.from, 'story-director');
  assert.equal(message.to, 'scene-builder');
  assert.equal(message.type, 'scene-request');
  assert.deepEqual(message.payload, { location: 'forest' });
  assert.ok(message.id);
  assert.ok(message.timestamp);
});

// 2. Missing sender
test('rejects messages without sender', () => {
  const { communication } = createSetup();

  assert.throws(
    () => communication.createMessage(
      '',
      'scene-builder',
      'request',
      {}
    ),
    /Sender and receiver are required/
  );
});

// 3. Missing receiver
test('rejects messages without receiver', () => {
  const { communication } = createSetup();

  assert.throws(
    () => communication.createMessage(
      'story-director',
      '',
      'request',
      {}
    ),
    /Sender and receiver are required/
  );
});

// 4. Missing message type
test('rejects messages without type', () => {
  const { communication } = createSetup();

  assert.throws(
    () => communication.createMessage(
      'story-director',
      'scene-builder',
      '',
      {}
    ),
    /Message type is required/
  );
});

// 5. Successful communication
test('sends message and receives response', async () => {
  const { communication } = createSetup();

  const result = await communication.send(
    'story-director',
    'scene-builder',
    'scene-request',
    { location: 'forest' }
  );

  assert.equal(result.success, true);
  assert.equal(result.response.scene, 'Forest scene created');
  assert.deepEqual(result.response.receivedPayload, {
    location: 'forest'
  });
});

// 6. Unknown sender
test('rejects unknown sender', async () => {
  const { communication } = createSetup();

  await assert.rejects(
    communication.send(
      'unknown-agent',
      'scene-builder',
      'request',
      {}
    ),
    /Sender agent .* does not exist/
  );
});

// 7. Unknown receiver
test('rejects unknown receiver', async () => {
  const { communication } = createSetup();

  await assert.rejects(
    communication.send(
      'story-director',
      'unknown-agent',
      'request',
      {}
    ),
    /Receiver agent .* does not exist/
  );
});

// 8. Disabled receiver
test('rejects disabled receiver', async () => {
  const { registry, communication } = createSetup();

  registry.disable('scene-builder');

  await assert.rejects(
    communication.send(
      'story-director',
      'scene-builder',
      'request',
      {}
    ),
    /is disabled/
  );
});

// 9. Agent processing error
test('handles agent processing errors', async () => {
  const { communication } = createSetup();

  await assert.rejects(
    communication.send(
      'story-director',
      'failing-agent',
      'request',
      {}
    ),
    /Agent processing failed/
  );

  const history = communication.getHistory({
    status: 'failed'
  });

  assert.equal(history.length, 1);
});

// 10. Message history
test('records communication history', async () => {
  const { communication } = createSetup();

  await communication.send(
    'story-director',
    'scene-builder',
    'request',
    { scene: 1 }
  );

  const history = communication.getHistory();

  assert.equal(history.length, 2);
  assert.equal(history[0].status, 'sent');
  assert.equal(history[1].status, 'completed');
});

// 11. Filter history by agent
test('filters history by agent', async () => {
  const { communication } = createSetup();

  await communication.send(
    'story-director',
    'scene-builder',
    'request',
    {}
  );

  const history = communication.getHistory({
    agent: 'scene-builder'
  });

  assert.equal(history.length, 2);
});

// 12. Filter history by status
test('filters history by status', async () => {
  const { communication } = createSetup();

  await communication.send(
    'story-director',
    'scene-builder',
    'request',
    {}
  );

  const history = communication.getHistory({
    status: 'completed'
  });

  assert.equal(history.length, 1);
});

// 13. Limit history
test('limits history results', async () => {
  const { communication } = createSetup();

  await communication.send(
    'story-director',
    'scene-builder',
    'request',
    { scene: 1 }
  );

  const history = communication.getHistory({
    limit: 1
  });

  assert.equal(history.length, 1);
});

// 14. Clear history
test('clears communication history', async () => {
  const { communication } = createSetup();

  await communication.send(
    'story-director',
    'scene-builder',
    'request',
    {}
  );

  communication.clearHistory();

  assert.equal(communication.getHistory().length, 0);
});

// 15. Statistics
test('returns communication statistics', async () => {
  const { communication } = createSetup();

  await communication.send(
    'story-director',
    'scene-builder',
    'request',
    {}
  );

  const stats = communication.getStats();

  assert.equal(stats.total, 2);
  assert.equal(stats.sent, 1);
  assert.equal(stats.completed, 1);
  assert.equal(stats.failed, 0);
});

// 16. History capacity
test('respects maximum history size', async () => {
  const registry = new AgentRegistry();

  registry.register({
    id: 'sender',
    name: 'Sender',
    handler: async () => ({ ok: true })
  });

  registry.register({
    id: 'receiver',
    name: 'Receiver',
    handler: async () => ({ ok: true })
  });

  const communication = new AgentCommunication(registry, {
    maxHistory: 3
  });

  await communication.send('sender', 'receiver', 'request', {});
  await communication.send('sender', 'receiver', 'request', {});

  assert.equal(communication.getHistory().length, 3);
});

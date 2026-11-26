
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const AgentCommunicationHub = require('./agent-communication-hub');

function createHub(options = {}) {
  return new AgentCommunicationHub(options);
}

test('registers agents', () => {
  const hub = createHub();

  const result = hub.registerAgent('agentA', async () => 'ok');

  assert.equal(result.success, true);
  assert.equal(hub.getStats().registeredAgents, 1);
});

test('rejects invalid agent registration', () => {
  const hub = createHub();

  assert.equal(
    hub.registerAgent('', async () => {}).success,
    false
  );

  assert.equal(
    hub.registerAgent('agentA', null).success,
    false
  );
});

test('unregisters agents', () => {
  const hub = createHub();

  hub.registerAgent('agentA', async () => 'ok');

  const result = hub.unregisterAgent('agentA');

  assert.equal(result.success, true);
  assert.equal(hub.getStats().registeredAgents, 0);
});

test('creates valid messages', () => {
  const hub = createHub();

  const result = hub.createMessage({
    from: 'agentA',
    to: 'agentB',
    payload: {
      task: 'analyze'
    }
  });

  assert.equal(result.success, true);
  assert.equal(result.message.from, 'agentA');
  assert.equal(result.message.to, 'agentB');
  assert.equal(result.message.status, 'created');
});

test('rejects missing sender or recipient', () => {
  const hub = createHub();

  assert.equal(
    hub.createMessage({
      from: 'agentA',
      payload: {}
    }).success,
    false
  );
});

test('rejects invalid priority', () => {
  const hub = createHub();

  const result = hub.createMessage({
    from: 'agentA',
    to: 'agentB',
    payload: {},
    priority: 'unknown'
  });

  assert.equal(result.success, false);
});

test('rejects oversized payloads', () => {
  const hub = createHub({
    maxMessageSize: 10
  });

  const result = hub.createMessage({
    from: 'agentA',
    to: 'agentB',
    payload: 'This payload is too large.'
  });

  assert.equal(result.success, false);
});

test('delivers messages to registered agents', async () => {
  const hub = createHub();

  hub.registerAgent('agentB', async message => ({
    received: message.payload
  }));

  const result = await hub.send({
    from: 'agentA',
    to: 'agentB',
    payload: {
      task: 'analyze'
    }
  });

  assert.equal(result.success, true);
  assert.deepEqual(result.response, {
    received: {
      task: 'analyze'
    }
  });
});

test('handles unregistered recipients', async () => {
  const hub = createHub();

  const result = await hub.send({
    from: 'agentA',
    to: 'missingAgent',
    payload: {}
  });

  assert.equal(result.success, false);
  assert.equal(result.message.status, 'undelivered');
});

test('records failed agent deliveries', async () => {
  const hub = createHub();

  hub.registerAgent('agentB', async () => {
    throw new Error('Agent failed');
  });

  const result = await hub.send({
    from: 'agentA',
    to: 'agentB',
    payload: {}
  });

  assert.equal(result.success, false);
  assert.equal(result.message.status, 'failed');
});

test('broadcasts to multiple agents', async () => {
  const hub = createHub();

  let received = 0;

  hub.registerAgent('agentB', async () => {
    received++;
    return 'B';
  });

  hub.registerAgent('agentC', async () => {
    received++;
    return 'C';
  });

  const result = await hub.broadcast({
    from: 'agentA',
    recipients: ['agentB', 'agentC'],
    payload: {
      update: true
    }
  });

  assert.equal(result.success, true);
  assert.equal(result.delivered, 2);
  assert.equal(received, 2);
});

test('broadcast reports partial failures', async () => {
  const hub = createHub();

  hub.registerAgent('agentB', async () => 'ok');

  const result = await hub.broadcast({
    from: 'agentA',
    recipients: ['agentB', 'missingAgent'],
    payload: {}
  });

  assert.equal(result.success, false);
  assert.equal(result.delivered, 1);
  assert.equal(result.failed, 1);
});

test('creates correlated requests', async () => {
  const hub = createHub();

  hub.registerAgent('agentB', async message => ({
    correlationId: message.correlationId
  }));

  const result = await hub.createRequest({
    from: 'agentA',
    to: 'agentB',
    payload: {
      question: 'test'
    }
  });

  assert.equal(result.success, true);
  assert.ok(result.message.correlationId);
  assert.equal(
    result.response.correlationId,
    result.message.correlationId
  );
});

test('filters message history by agent', async () => {
  const hub = createHub();

  hub.registerAgent('agentB', async () => 'ok');

  await hub.send({
    from: 'agentA',
    to: 'agentB',
    payload: { first: true }
  });

  await hub.send({
    from: 'agentC',
    to: 'agentB',
    payload: { second: true }
  });

  const history = hub.getHistory({
    agentId: 'agentA'
  });

  assert.ok(history.length > 0);
  assert.ok(
    history.every(
      message =>
        message.from === 'agentA' ||
        message.to === 'agentA'
    )
  );
});

test('filters history by message type', async () => {
  const hub = createHub();

  hub.registerAgent('agentB', async () => 'ok');

  await hub.send({
    from: 'agentA',
    to: 'agentB',
    type: 'analysis',
    payload: {}
  });

  const history = hub.getHistory({
    type: 'analysis'
  });

  assert.ok(history.length > 0);
  assert.ok(
    history.every(message => message.type === 'analysis')
  );
});

test('limits message history', async () => {
  const hub = createHub({
    maxHistory: 3
  });

  hub.registerAgent('agentB', async () => 'ok');

  for (let i = 0; i < 5; i++) {
    await hub.send({
      from: 'agentA',
      to: 'agentB',
      payload: { index: i }
    });
  }

  assert.ok(hub.history.length <= 3);
});

test('returns communication statistics', () => {
  const hub = createHub();

  hub.registerAgent('agentA', async () => {});
  hub.registerAgent('agentB', async () => {});

  const stats = hub.getStats();

  assert.equal(stats.registeredAgents, 2);
  assert.deepEqual(stats.agents, ['agentA', 'agentB']);
});

test('clears message history', async () => {
  const hub = createHub();

  hub.registerAgent('agentB', async () => 'ok');

  await hub.send({
    from: 'agentA',
    to: 'agentB',
    payload: {}
  });

  hub.clearHistory();

  assert.equal(hub.history.length, 0);
});

test('supports zero history limit', async () => {
  const hub = createHub({
    maxHistory: 0
  });

  hub.registerAgent('agentB', async () => 'ok');

  await hub.send({
    from: 'agentA',
    to: 'agentB',
    payload: {}
  });

  assert.equal(hub.history.length, 0);
});
     

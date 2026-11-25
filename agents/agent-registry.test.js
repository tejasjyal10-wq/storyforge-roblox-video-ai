
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { AgentRegistry } = require('./agent-registry');

// ------------------------------------------
// Test 1: Agent registration
// ------------------------------------------

test('registers an agent successfully', () => {
  const registry = new AgentRegistry();

  registry.register({
    id: 'story-agent',
    name: 'Story Agent',
    handler: async () => ({ story: 'Test story' }),
    capabilities: ['story-generation', 'plot-planning']
  });

  assert.equal(registry.has('story-agent'), true);

  const agent = registry.getAgent('story-agent');

  assert.equal(agent.name, 'Story Agent');
  assert.equal(agent.enabled, true);
  assert.deepEqual(agent.capabilities, [
    'story-generation',
    'plot-planning'
  ]);
});

// ------------------------------------------
// Test 2: Duplicate registration protection
// ------------------------------------------

test('rejects duplicate agent IDs', () => {
  const registry = new AgentRegistry();

  const agent = {
    id: 'story-agent',
    name: 'Story Agent',
    handler: async () => ({})
  };

  registry.register(agent);

  assert.throws(
    () => registry.register(agent),
    /already registered/i
  );
});

// ------------------------------------------
// Test 3: Invalid agent validation
// ------------------------------------------

test('rejects agents without valid handlers', () => {
  const registry = new AgentRegistry();

  assert.throws(
    () => registry.register({
      id: 'invalid-agent',
      name: 'Invalid Agent'
    }),
    /handler function/i
  );
});

// ------------------------------------------
// Test 4: Capability discovery
// ------------------------------------------

test('finds agents by capability', () => {
  const registry = new AgentRegistry();

  registry.register({
    id: 'story-agent',
    name: 'Story Agent',
    handler: async () => ({}),
    capabilities: ['story-generation', 'plot-planning']
  });

  registry.register({
    id: 'animation-agent',
    name: 'Animation Agent',
    handler: async () => ({}),
    capabilities: ['animation', 'movement']
  });

  const results = registry.findByCapability(
    'story-generation'
  );

  assert.equal(results.length, 1);
  assert.equal(results[0].id, 'story-agent');
});

// ------------------------------------------
// Test 5: Enable and disable lifecycle
// ------------------------------------------

test('enables and disables agents', () => {
  const registry = new AgentRegistry();

  registry.register({
    id: 'character-agent',
    name: 'Character Agent',
    handler: async () => ({}),
    enabled: true
  });

  registry.disable('character-agent');

  assert.equal(
    registry.getAgent('character-agent').enabled,
    false
  );

  assert.equal(registry.getHandler('character-agent'), null);

  registry.enable('character-agent');

  assert.equal(
    registry.getAgent('character-agent').enabled,
    true
  );

  assert.equal(
    typeof registry.getHandler('character-agent'),
    'function'
  );
});

// ------------------------------------------
// Test 6: Agent updates
// ------------------------------------------

test('updates agent properties', () => {
  const registry = new AgentRegistry();

  registry.register({
    id: 'scene-agent',
    name: 'Scene Agent',
    handler: async () => ({}),
    capabilities: ['scene-planning'],
    metadata: { version: 1 }
  });

  registry.update('scene-agent', {
    name: 'Advanced Scene Agent',
    description: 'Plans detailed scenes.',
    capabilities: ['scene-planning', 'environment-design'],
    metadata: { version: 2 }
  });

  const agent = registry.getAgent('scene-agent');

  assert.equal(agent.name, 'Advanced Scene Agent');
  assert.equal(agent.description, 'Plans detailed scenes.');

  assert.deepEqual(agent.capabilities, [
    'scene-planning',
    'environment-design'
  ]);

  assert.deepEqual(agent.metadata, { version: 2 });
});

// ------------------------------------------
// Test 7: Agent removal
// ------------------------------------------

test('removes an agent from the registry', () => {
  const registry = new AgentRegistry();

  registry.register({
    id: 'dialogue-agent',
    name: 'Dialogue Agent',
    handler: async () => ({})
  });

  assert.equal(registry.unregister('dialogue-agent'), true);
  assert.equal(registry.has('dialogue-agent'), false);
  assert.equal(registry.getAgent('dialogue-agent'), null);
});

// ------------------------------------------
// Test 8: Registry statistics
// ------------------------------------------

test('reports correct registry statistics', () => {
  const registry = new AgentRegistry();

  registry.register({
    id: 'story-agent',
    name: 'Story Agent',
    handler: async () => ({}),
    capabilities: ['story-generation']
  });

  registry.register({
    id: 'character-agent',
    name: 'Character Agent',
    handler: async () => ({}),
    capabilities: ['character-design'],
    enabled: false
  });

  const stats = registry.getStats();

  assert.equal(stats.total, 2);
  assert.equal(stats.enabled, 1);
  assert.equal(stats.disabled, 1);

  assert.deepEqual(stats.capabilities, [
    'character-design',
    'story-generation'
  ]);
});

// ------------------------------------------
// Test 9: Enabled-only listing
// ------------------------------------------

test('lists only enabled agents when requested', () => {
  const registry = new AgentRegistry();

  registry.register({
    id: 'story-agent',
    name: 'Story Agent',
    handler: async () => ({})
  });

  registry.register({
    id: 'world-agent',
    name: 'World Agent',
    handler: async () => ({}),
    enabled: false
  });

  const enabledAgents = registry.getAgents({
    enabledOnly: true
  });

  assert.equal(enabledAgents.length, 1);
  assert.equal(enabledAgents[0].id, 'story-agent');
});

// ------------------------------------------
// Test 10: Unknown agent lifecycle errors
// ------------------------------------------

test('rejects lifecycle operations for unknown agents', () => {
  const registry = new AgentRegistry();

  assert.throws(
    () => registry.enable('missing-agent'),
    /not found/i
  );

  assert.throws(
    () => registry.disable('missing-agent'),
    /not found/i
  );

  assert.throws(
    () => registry.update('missing-agent', {}),
    /not found/i
  );
});
     


'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const IntelligenceMemory = require('./intelligence-memory');

function createMemory(options = {}) {
  return new IntelligenceMemory(options);
}

test('stores and retrieves a memory', () => {
  const memory = createMemory();

  const stored = memory.store({
    content: 'The story protagonist is named Arin.',
    category: 'character',
    tags: ['protagonist', 'name']
  });

  assert.equal(stored.success, true);

  const results = memory.search('protagonist Arin');

  assert.ok(results.length > 0);
  assert.ok(
    results.some(item =>
      item.content.includes('Arin')
    )
  );
});

test('rejects empty memory content', () => {
  const memory = createMemory();

  const result = memory.store({
    content: '   '
  });

  assert.equal(result.success, false);
});

test('supports categories and tags', () => {
  const memory = createMemory();

  memory.store({
    content: 'The world contains floating islands.',
    category: 'world',
    tags: ['fantasy', 'geography']
  });

  const results = memory.search('floating islands');

  assert.ok(results.length > 0);
  assert.equal(results[0].category, 'world');
});

test('detects duplicate memories', () => {
  const memory = createMemory();

  memory.store({
    content: 'The main character uses a blue sword.',
    category: 'character'
  });

  const duplicate = memory.store({
    content: 'The main character uses a blue sword.',
    category: 'character'
  });

  assert.equal(duplicate.success, false);
  assert.equal(duplicate.duplicate, true);
});

test('updates an existing memory', () => {
  const memory = createMemory();

  const stored = memory.store({
    content: 'The protagonist lives in a village.',
    category: 'world'
  });

  const id = stored.memory.id;

  const updated = memory.update(id, {
    content: 'The protagonist lives in a mountain village.'
  });

  assert.equal(updated.success, true);

  const results = memory.search('mountain village');

  assert.ok(
    results.some(item =>
      item.content.includes('mountain village')
    )
  );
});

test('removes a memory', () => {
  const memory = createMemory();

  const stored = memory.store({
    content: 'The castle is beside a lake.',
    category: 'location'
  });

  const id = stored.memory.id;

  const removed = memory.remove(id);

  assert.equal(removed.success, true);
  assert.equal(memory.get(id), null);
});

test('exports and imports memories', () => {
  const first = createMemory();

  first.store({
    content: 'The hero can control wind.',
    category: 'ability',
    tags: ['wind']
  });

  const exported = first.export();

  const second = createMemory();

  const imported = second.import(exported);

  assert.equal(imported.success, true);

  const results = second.search('control wind');

  assert.ok(results.length > 0);
});

test('prevents exceeding memory capacity', () => {
  const memory = createMemory({
    maxMemories: 1
  });

  const first = memory.store({
    content: 'Memory one',
    category: 'test'
  });

  const second = memory.store({
    content: 'Memory two',
    category: 'test'
  });

  assert.equal(first.success, true);
  assert.equal(second.success, false);
});

test('returns memory statistics', () => {
  const memory = createMemory();

  memory.store({
    content: 'Character memory',
    category: 'character'
  });

  memory.store({
    content: 'World memory',
    category: 'world'
  });

  const stats = memory.getStats();

  assert.equal(stats.total, 2);
  assert.ok(stats.categories);
});

test('clears memories', () => {
  const memory = createMemory();

  memory.store({
    content: 'Temporary memory',
    category: 'test'
  });

  memory.clear();

  assert.equal(memory.getStats().total, 0);
});

test('returns the last analysis', () => {
  const memory = createMemory();

  memory.store({
    content: 'The hero is brave.',
    category: 'character'
  });

  memory.search('hero brave');

  const analysis = memory.getLastAnalysis();

  assert.ok(analysis);
});

test('supports retrieving memories by ID', () => {
  const memory = createMemory();

  const stored = memory.store({
    content: 'The kingdom is ruled by a council.',
    category: 'world'
  });

  assert.ok(memory.get(stored.memory.id));
});

test('supports normalized search queries', () => {
  const memory = createMemory();

  memory.store({
    content: 'The ancient dragon guards the mountain.',
    category: 'creature'
  });

  const results = memory.search('ANCIENT DRAGON');

  assert.ok(results.length > 0);
});

test('does not return removed memories in searches', () => {
  const memory = createMemory();

  const stored = memory.store({
    content: 'The hidden forest is magical.',
    category: 'location'
  });

  memory.remove(stored.memory.id);

  const results = memory.search('hidden forest');

  assert.equal(results.length, 0);
});

test('returns the most relevant results first', () => {
  const memory = createMemory();

  memory.store({
    content: 'A mountain village has a river.',
    category: 'location',
    tags: ['river']
  });

  memory.store({
    content: 'The hero travels across the desert.',
    category: 'story',
    tags: ['journey']
  });

  const results = memory.search('mountain village river');

  assert.ok(results.length > 0);
  assert.match(results[0].content, /mountain village/i);
});

test('supports metadata on stored memories', () => {
  const memory = createMemory();

  const stored = memory.store({
    content: 'The character has a silver cloak.',
    category: 'character',
    metadata: {
      source: 'story-planning',
      importance: 5
    }
  });

  assert.equal(stored.success, true);
  assert.equal(stored.memory.metadata.source, 'story-planning');
});
    

const test = require('node:test');
const assert = require('node:assert/strict');
const { splitStoryIntoScenes } = require('../storyforge-local-planner');

test('returns at least five editable scene cards for a short story', () => {
  const scenes = splitStoryIntoScenes('A child enters a forest. They find a map.');
  assert.equal(scenes.length, 5);
  assert.match(scenes[0].description, /enters a forest/i);
  assert.ok(scenes.every(s => typeof s.title === 'string' && typeof s.description === 'string'));
});

test('uses explicit placeholders instead of inventing plot when the story is short', () => {
  const scenes = splitStoryIntoScenes('A student opens a book.');
  assert.equal(scenes.length, 5);
  assert.ok(scenes.slice(1).every(s => s.notes === 'Placeholder, not generated story content.'));
});

test('caps the plan at twelve scene cards for long text', () => {
  const story = Array.from({ length: 20 }, (_, i) => `Beat ${i + 1} happens.`).join(' ');
  assert.equal(splitStoryIntoScenes(story).length, 12);
});

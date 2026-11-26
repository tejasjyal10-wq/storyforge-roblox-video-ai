'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const StoryContext = require('./story-context');

// --------------------------------------------------
// 1. Creation
// --------------------------------------------------

test('creates a story context with default values', () => {
  const context = new StoryContext();

  assert.ok(context.storyId);
  assert.equal(context.metadata.title, 'Untitled Story');
  assert.equal(context.status, 'created');
  assert.equal(context.version, 1);
  assert.deepEqual(context.scenes, []);
  assert.deepEqual(context.characters, []);
});

// --------------------------------------------------
// 2. Original prompt preservation
// --------------------------------------------------

test('preserves the original user prompt', () => {
  const prompt = 'Create an adventure about a boy saving his village.';
  const context = new StoryContext({ prompt });

  assert.equal(context.originalPrompt, prompt);
});

// --------------------------------------------------
// 3. Metadata updates
// --------------------------------------------------

test('updates metadata correctly', () => {
  const context = new StoryContext();

  context.updateMetadata({
    genre: 'Fantasy',
    tone: 'Adventurous',
    duration: 300
  });

  assert.equal(context.metadata.genre, 'Fantasy');
  assert.equal(context.metadata.tone, 'Adventurous');
  assert.equal(context.metadata.duration, 300);
});

// --------------------------------------------------
// 4. Requirements
// --------------------------------------------------

test('updates and preserves requirements', () => {
  const context = new StoryContext();

  context.updateRequirements({
    includeRoblox: true,
    animationRequired: true
  });

  context.updateRequirements({
    audioRequired: true
  });

  assert.equal(context.requirements.includeRoblox, true);
  assert.equal(context.requirements.animationRequired, true);
  assert.equal(context.requirements.audioRequired, true);
});

// --------------------------------------------------
// 5. Restrictions
// --------------------------------------------------

test('adds restrictions and prevents duplicates', () => {
  const context = new StoryContext();

  context.addRestriction('No graphic violence');
  context.addRestriction('No graphic violence');

  assert.deepEqual(context.restrictions, [
    'No graphic violence'
  ]);
});

test('rejects empty restrictions', () => {
  const context = new StoryContext();

  assert.throws(
    () => context.addRestriction(''),
    /non-empty string/
  );
});

// --------------------------------------------------
// 6. Story updates
// --------------------------------------------------

test('updates story sections', () => {
  const context = new StoryContext();

  context.updateStory({
    logline: 'A young hero saves a village.',
    summary: 'An adventure begins.'
  });

  assert.equal(
    context.story.logline,
    'A young hero saves a village.'
  );

  assert.equal(
    context.story.summary,
    'An adventure begins.'
  );
});

// --------------------------------------------------
// 7. Scenes
// --------------------------------------------------

test('stores scene data', () => {
  const context = new StoryContext();

  const scenes = [
    {
      id: 'scene-1',
      title: 'Village Introduction',
      location: 'Village',
      actions: ['Walk', 'Talk']
    }
  ];

  context.setScenes(scenes);

  assert.deepEqual(context.scenes, scenes);
});

// --------------------------------------------------
// 8. Characters
// --------------------------------------------------

test('stores character data', () => {
  const context = new StoryContext();

  const characters = [
    {
      id: 'character-1',
      name: 'Arin',
      role: 'Hero',
      personality: ['Brave', 'Curious']
    }
  ];

  context.setCharacters(characters);

  assert.deepEqual(context.characters, characters);
});

// --------------------------------------------------
// 9. World
// --------------------------------------------------

test('updates world information', () => {
  const context = new StoryContext();

  context.updateWorld({
    description: 'A fantasy village surrounded by forests.',
    locations: ['Village', 'Forest'],
    atmosphere: 'Mystical'
  });

  assert.equal(
    context.world.description,
    'A fantasy village surrounded by forests.'
  );

  assert.deepEqual(
    context.world.locations,
    ['Village', 'Forest']
  );

  assert.equal(context.world.atmosphere, 'Mystical');
});

// --------------------------------------------------
// 10. Continuity
// --------------------------------------------------

test('updates continuity information', () => {
  const context = new StoryContext();

  context.updateContinuity({
    facts: ['The hero carries a blue sword.'],
    rules: ['The sword cannot be destroyed.'],
    unresolvedIssues: ['Hero origin is unknown.']
  });

  assert.equal(
    context.continuity.facts[0],
    'The hero carries a blue sword.'
  );

  assert.equal(
    context.continuity.rules[0],
    'The sword cannot be destroyed.'
  );

  assert.equal(
    context.continuity.unresolvedIssues[0],
    'Hero origin is unknown.'
  );
});

// --------------------------------------------------
// 11. Agent execution records
// --------------------------------------------------

test('records agent execution', () => {
  const context = new StoryContext();

  const record = context.recordAgentExecution({
    agentId: 'story-director',
    stage: 'story-analysis',
    status: 'completed',
    durationMs: 1200,
    outputSummary: 'Story analyzed'
  });

  assert.equal(record.agentId, 'story-director');
  assert.equal(record.status, 'completed');
  assert.equal(record.durationMs, 1200);

  assert.equal(context.agentRecords.length, 1);
});

// --------------------------------------------------
// 12. Validation
// --------------------------------------------------

test('records validation errors and warnings', () => {
  const context = new StoryContext();

  context.setValidation({
    status: 'failed',
    errors: ['Missing story ending'],
    warnings: ['Character description incomplete']
  });

  assert.equal(context.validation.status, 'failed');

  assert.deepEqual(
    context.validation.errors,
    ['Missing story ending']
  );

  assert.deepEqual(
    context.validation.warnings,
    ['Character description incomplete']
  );

  assert.ok(context.validation.lastCheckedAt);
});

// --------------------------------------------------
// 13. Version tracking
// --------------------------------------------------

test('increases version after updates', () => {
  const context = new StoryContext();
  const initialVersion = context.version;

  context.updateMetadata({ genre: 'Adventure' });
  context.updateStory({ summary: 'Test story' });

  assert.equal(context.version, initialVersion + 2);
  assert.ok(context.updatedAt);
});

// --------------------------------------------------
// 14. Snapshot
// --------------------------------------------------

test('snapshot returns an independent copy', () => {
  const context = new StoryContext({
    prompt: 'Original prompt'
  });

  const snapshot = context.snapshot();

  snapshot.metadata.title = 'Changed title';
  snapshot.originalPrompt = 'Changed prompt';

  assert.notEqual(
    context.metadata.title,
    'Changed title'
  );

  assert.equal(
    context.originalPrompt,
    'Original prompt'
  );
});

// --------------------------------------------------
// 15. JSON serialization and restoration
// --------------------------------------------------

test('serializes and restores story context', () => {
  const context = new StoryContext({
    title: 'Test Adventure',
    prompt: 'A hero explores a mysterious world.'
  });

  context.updateStory({
    logline: 'A hero discovers a hidden world.'
  });

  context.setScenes([
    { id: 'scene-1', title: 'Opening' }
  ]);

  const serialized = JSON.stringify(context);
  const parsed = JSON.parse(serialized);

  const restored = StoryContext.fromJSON(parsed);

  assert.equal(restored.storyId, context.storyId);
  assert.equal(restored.metadata.title, 'Test Adventure');
  assert.equal(
    restored.originalPrompt,
    'A hero explores a mysterious world.'
  );

  assert.equal(
    restored.story.logline,
    'A hero discovers a hidden world.'
  );

  assert.deepEqual(restored.scenes, context.scenes);
});

// --------------------------------------------------
// 16. Error handling
// --------------------------------------------------

test('rejects invalid scene data', () => {
  const context = new StoryContext();

  assert.throws(
    () => context.setScenes('invalid'),
    /Scenes must be an array/
  );
});

test('rejects invalid character data', () => {
  const context = new StoryContext();

  assert.throws(
    () => context.setCharacters('invalid'),
    /Characters must be an array/
  );
});

test('rejects invalid story context restoration', () => {
  assert.throws(
    () => StoryContext.fromJSON(null),
    /must be an object/
  );
});

// --------------------------------------------------
// 17. Status
// --------------------------------------------------

test('updates context status', () => {
  const context = new StoryContext();

  context.setStatus('in-progress');

  assert.equal(context.status, 'in-progress');
});

test('rejects empty status', () => {
  const context = new StoryContext();

  assert.throws(
    () => context.setStatus(''),
    /non-empty string/
  );
});

// --------------------------------------------------
// 18. Section retrieval
// --------------------------------------------------

test('retrieves sections safely', () => {
  const context = new StoryContext();

  const metadata = context.getSection('metadata');

  assert.deepEqual(metadata, context.metadata);
  assert.notEqual(metadata, context.metadata);
});

test('rejects unknown sections', () => {
  const context = new StoryContext();

  assert.throws(
    () => context.getSection('unknownSection'),
    /Unknown story context section/
  );
});
    

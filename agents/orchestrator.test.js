
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  StoryForgeOrchestrator
} = require('./orchestrator');

// ------------------------------------------
// Test 1: Agent registration
// ------------------------------------------

test('registers agents successfully', () => {
  const engine = new StoryForgeOrchestrator();

  engine.registerAgent(
    'story-agent',
    async () => ({ story: 'A test story' })
  );

  const agents = engine.getAgents();

  assert.equal(agents.length, 1);
  assert.equal(agents[0].name, 'story-agent');
});

// ------------------------------------------
// Test 2: Independent agents execute
// ------------------------------------------

test('executes independent tasks successfully', async () => {
  const engine = new StoryForgeOrchestrator({
    maxConcurrency: 3
  });

  engine.registerAgent('story-agent', async () => ({
    story: 'A hero begins a journey'
  }));

  engine.registerAgent('character-agent', async () => ({
    character: 'Hero'
  }));

  const workflowId = engine.createWorkflow([
    {
      id: 'story',
      agent: 'story-agent'
    },
    {
      id: 'character',
      agent: 'character-agent'
    }
  ]);

  const result = await engine.runWorkflow(workflowId);

  assert.equal(result.status, 'completed');

  assert.equal(
    result.tasks.find(t => t.id === 'story').status,
    'completed'
  );

  assert.equal(
    result.tasks.find(t => t.id === 'character').status,
    'completed'
  );
});

// ------------------------------------------
// Test 3: Dependency results are passed
// ------------------------------------------

test('passes dependency results to the next agent', async () => {
  const engine = new StoryForgeOrchestrator();

  engine.registerAgent('story-agent', async () => ({
    title: 'The Forest Adventure'
  }));

  engine.registerAgent(
    'animation-agent',
    async ({ dependencyResults }) => ({
      animation: 'walking',
      receivedStory: dependencyResults.story.title
    })
  );

  const workflowId = engine.createWorkflow([
    {
      id: 'story',
      agent: 'story-agent'
    },
    {
      id: 'animation',
      agent: 'animation-agent',
      dependsOn: ['story']
    }
  ]);

  const result = await engine.runWorkflow(workflowId);

  assert.equal(result.status, 'completed');

  const animationTask = result.tasks.find(
    t => t.id === 'animation'
  );

  assert.equal(animationTask.status, 'completed');

  assert.equal(
    animationTask.result.receivedStory,
    'The Forest Adventure'
  );
});

// ------------------------------------------
// Test 4: Failed agent handling
// ------------------------------------------

test('marks a failed agent task correctly', async () => {
  const engine = new StoryForgeOrchestrator({
    defaultRetries: 0
  });

  engine.registerAgent('broken-agent', async () => {
    throw new Error('Simulated agent failure');
  });

  const workflowId = engine.createWorkflow([
    {
      id: 'failure',
      agent: 'broken-agent'
    }
  ]);

  const result = await engine.runWorkflow(workflowId);

  assert.equal(result.status, 'failed');

  assert.equal(
    result.tasks[0].status,
    'failed'
  );

  assert.match(
    result.tasks[0].error,
    /Simulated agent failure/
  );
});

// ------------------------------------------
// Test 5: Invalid dependencies
// ------------------------------------------

test('rejects unknown dependencies', () => {
  const engine = new StoryForgeOrchestrator();

  assert.throws(() => {
    engine.createWorkflow([
      {
        id: 'animation',
        agent: 'animation-agent',
        dependsOn: ['unknown-task']
      }
    ]);
  }, /unknown task/i);
});

// ------------------------------------------
// Test 6: Circular dependency detection
// ------------------------------------------

test('rejects circular dependencies', () => {
  const engine = new StoryForgeOrchestrator();

  assert.throws(() => {
    engine.createWorkflow([
      {
        id: 'story',
        agent: 'story-agent',
        dependsOn: ['animation']
      },
      {
        id: 'animation',
        agent: 'animation-agent',
        dependsOn: ['story']
      }
    ]);
  }, /dependency cycle/i);
});

// ------------------------------------------
// Test 7: Concurrency limit
// ------------------------------------------

test('respects the concurrency limit', async () => {
  const engine = new StoryForgeOrchestrator({
    maxConcurrency: 2
  });

  let active = 0;
  let maximumActive = 0;

  engine.registerAgent('slow-agent', async () => {
    active++;

    maximumActive = Math.max(
      maximumActive,
      active
    );

    await new Promise(resolve =>
      setTimeout(resolve, 100)
    );

    active--;

    return { completed: true };
  });

  const workflowId = engine.createWorkflow([
    { id: 'task1', agent: 'slow-agent' },
    { id: 'task2', agent: 'slow-agent' },
    { id: 'task3', agent: 'slow-agent' },
    { id: 'task4', agent: 'slow-agent' }
  ]);

  const result = await engine.runWorkflow(workflowId);

  assert.equal(result.status, 'completed');
  assert.equal(maximumActive, 2);
});

// ------------------------------------------
// Test 8: Unknown agent handling
// ------------------------------------------

test('fails when an agent is not registered', async () => {
  const engine = new StoryForgeOrchestrator();

  const workflowId = engine.createWorkflow([
    {
      id: 'task1',
      agent: 'missing-agent'
    }
  ]);

  const result = await engine.runWorkflow(workflowId);

  assert.equal(result.status, 'failed');
  assert.equal(result.tasks[0].status, 'failed');
  assert.match(result.tasks[0].error, /unavailable/i);
});
    


'use strict';

const assert = require('node:assert/strict');
const { createStoryDirectorIntegration } = require('../core/story-director-integration');

async function runTests() {
  const integration = createStoryDirectorIntegration();

  // Test 1: Story Director is registered
  assert.equal(integration.registry.has('storyDirector'), true);

  // Test 2: Agent Registry contains the agent
  assert.equal(integration.registry.count(), 1);

  // Test 3: Pipeline accepts a story idea
  const result = await integration.run(
    'A young Roblox explorer discovers a mysterious hidden city.'
  );

  assert.ok(result);
  assert.ok(result.jobId);

  // Test 4: Job is created
  const job = integration.getJob(result.jobId);
  assert.ok(job);

  // Test 5: Story Director produces an output
  assert.ok(result.outputs);
  assert.ok(result.outputs.storyDirector);

  // Test 6: Story concept contains a title
  assert.ok(result.outputs.storyDirector.concept.title);

  // Test 7: Story concept contains a genre
  assert.ok(result.outputs.storyDirector.concept.genre);

  // Test 8: Story concept contains themes
  assert.ok(Array.isArray(result.outputs.storyDirector.concept.themes));

  // Test 9: Empty idea is rejected
  await assert.rejects(
    () => integration.run(''),
    /valid story idea/
  );

  // Test 10: Job completes successfully
  assert.equal(job.status, 'completed');

  console.log('STORY DIRECTOR: ALL 10 TESTS PASSED');
}

runTests().catch(error => {
  console.error('STORY DIRECTOR TEST FAILURE');
  console.error(error);
  process.exitCode = 1;
});

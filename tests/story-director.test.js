
'use strict';

const assert = require('node:assert/strict');
const { createStoryDirectorIntegration } = require('../core/story-director-integration');

async function runTests() {
  const integration = createStoryDirectorIntegration();

  // Test 1: Story Director is registered
  assert.equal(integration.registry.has('storyDirector'), true);

  // Test 2: Exactly one agent is registered
  assert.equal(integration.registry.count, 1);

  // Test 3: Pipeline accepts a story idea
  const result = await integration.run(
    'A young Roblox explorer discovers a mysterious hidden city.'
  );

  assert.ok(result);
  assert.ok(result.jobId);

  // Test 4: Job is created and retrievable
  const job = integration.getJob(result.jobId);
  assert.ok(job);

  // Test 5: Story Director produces an output
  if (!job.outputs.storyDirector) {
    console.error('JOB STATUS:', job.status);
    console.error('STAGES:', JSON.stringify(job.stages, null, 2));
    console.error('ERRORS:', JSON.stringify(job.errors, null, 2));
  }

  assert.ok(job.outputs.storyDirector);

  // Test 6: Story concept contains a title
  assert.ok(job.outputs.storyDirector.concept.title);

  // Test 7: Story concept contains a genre
  assert.ok(job.outputs.storyDirector.concept.genre);

  // Test 8: Story concept contains themes
  assert.ok(Array.isArray(job.outputs.storyDirector.concept.themes));

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

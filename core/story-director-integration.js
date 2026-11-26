
'use strict';

const JobManager = require('./job-manager');
const AgentRegistry = require('./agent-registry');
const PipelineEngine = require('./pipeline-engine');
const { createStoryDirector } = require('../agents/story-director');

function createStoryDirectorIntegration() {
  const jobManager = new JobManager();
  const registry = new AgentRegistry();
  const pipeline = new PipelineEngine({ registry, jobManager });

  const storyDirector = createStoryDirector();

  registry.register(storyDirector.id, storyDirector);

  async function run(idea) {
    if (!idea || typeof idea !== 'string' || !idea.trim()) {
      throw new Error('A valid story idea is required.');
    }

    return pipeline.run({
      idea: idea.trim(),
      stages: [
        { id: storyDirector.id, name: storyDirector.name }
      ]
    });
  }

  return {
    run,
    getJob: id => jobManager.getJob(id),
    listJobs: () => jobManager.listJobs(),
    registry,
    pipeline,
    jobManager
  };
}

module.exports = { createStoryDirectorIntegration };

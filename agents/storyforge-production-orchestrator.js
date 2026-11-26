'use strict';

const express = require('express');

const PIPELINE = [
  { id: 'storyDirector', name: 'Story Director', purpose: 'Turn the user idea into a structured story concept.' },
  { id: 'storyWriter', name: 'Story Writer', purpose: 'Write the complete script, narration, and dialogue.' },
  { id: 'scenePlanner', name: 'Scene Planner', purpose: 'Break the script into timed, production-ready scenes.' },
  { id: 'characterAI', name: 'Character AI', purpose: 'Define and preserve character identities and continuity.' },
  { id: 'worldBuilder', name: 'World Builder', purpose: 'Plan locations, props, environments, and world details.' },
  { id: 'animationDirector', name: 'Animation Director', purpose: 'Specify character actions, movement, expressions, and animation.' },
  { id: 'cameraDirector', name: 'Camera Director', purpose: 'Plan shots, framing, camera movement, and transitions.' },
  { id: 'audioDirector', name: 'Voice & Audio Director', purpose: 'Plan dialogue voice assignments, music, ambience, and sound effects.' },
  { id: 'robloxBuilder', name: 'Roblox Builder', purpose: 'Convert scene plans into Roblox-compatible build instructions, including obstacles.' },
  { id: 'sceneAssembly', name: 'Scene Assembly', purpose: 'Combine scene outputs into a generation-ready package.' },
  { id: 'continuityValidator', name: 'Continuity Validator', purpose: 'Check story, character, and environment continuity.' },
  { id: 'complianceChecker', name: 'Prompt Compliance Checker', purpose: "Check planned output against the user's requested content." },
  { id: 'videoProviderManager', name: 'Video Provider Manager', purpose: 'Submit approved generation tasks and track provider responses.' },
  { id: 'videoReviewer', name: 'Video Reviewer', purpose: 'Review generated output and identify specific issues.' },
  { id: 'revisionAI', name: 'Revision AI', purpose: 'Create targeted revision instructions based on review findings.' },
  { id: 'learningAgent', name: 'Learning Agent', purpose: 'Record approved feedback for future improvement.' }
];


function createProductionOrchestrator(options = {}) {
  const agents = options.agents || {};
  const jobs = new Map();


  function getAgentStatus() {
    return PIPELINE.map(stage => ({
      id: stage.id,
      name: stage.name,
      purpose: stage.purpose,
      available: typeof agents[stage.id] === 'function'
    }));
  }


  async function run(input = {}) {
    const idea = String(input.idea || input.prompt || '').trim();
    if (!idea) {
      const error = new Error('Please provide a story idea or prompt.');
      error.status = 400;
      throw error;
    }

    const jobId = `sfprod_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const job = {
      jobId,
      idea,
      status: 'running',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      stages: PIPELINE.map(stage => ({
        id: stage.id,
        name: stage.name,
        status: typeof agents[stage.id] === 'function' ? 'pending' : 'unavailable'
      })),
      outputs: {},
      errors: []
    };
    jobs.set(jobId, job);

    let context = { idea, input: { ...input } };
    let failed = false;

    for (const stage of PIPELINE) {
      const agent = agents[stage.id];
      const record = job.stages.find(item => item.id === stage.id);
      if (typeof agent !== 'function') continue;

      record.status = 'running';
      record.startedAt = Date.now();
      job.updatedAt = Date.now();

      try {
        const output = await agent(context);
        if (output === undefined || output === null) {
          throw new Error(`${stage.name} returned an empty result.`);
        }
        job.outputs[stage.id] = output;
        context = { ...context, [stage.id]: output, previousOutput: output };
        record.status = 'completed';
        record.finishedAt = Date.now();
      } catch (error) {
        record.status = 'failed';
        record.error = error.message || `${stage.name} failed.`;
        record.finishedAt = Date.now();
        job.errors.push({ stage: stage.id, message: record.error });
        failed = true;
        // Stop downstream stages: their inputs may be incomplete or invalid.
        break;
      }
      job.updatedAt = Date.now();
    }

    const availableStages = job.stages.filter(s => s.status !== 'unavailable');
    const completedStages = job.stages.filter(s => s.status === 'completed');
    const failedStages = job.stages.filter(s => s.status === 'failed');
    const unavailableStages = job.stages.filter(s => s.status === 'unavailable');

    job.status = failed
      ? 'failed'
      : unavailableStages.length > 0
        ? (completedStages.length > 0 ? 'partial' : 'not_ready')
        : 'completed';
    job.summary = {
      totalStages: PIPELINE.length,
      availableStages: availableStages.length,
      completedStages: completedStages.length,
      failedStages: failedStages.length,
      unavailableStages: unavailableStages.length
    };
    job.updatedAt = Date.now();
    return job;
  }


  return { run, getAgentStatus, jobs };
}


function createProductionOrchestratorRouter(options = {}) {
  const router = express.Router();
  const orchestrator = createProductionOrchestrator(options);


  router.get('/status', (_req, res) => {
    res.json({
      ok: true,
      orchestrator: 'StoryForge Production Orchestrator',
      mode: 'agent-registry',
      agents: orchestrator.getAgentStatus()
    });
  });


  router.post('/run', async (req, res) => {
    try {
      const job = await orchestrator.run(req.body || {});
      const statusCode = job.status === 'failed' ? 502 : 200;
      res.status(statusCode).json(job);
    } catch (error) {
      res.status(error.status || 500).json({
        ok: false,
        error: error.message || 'Production orchestration failed.'
      });
    }
  });


  router.get('/jobs/:jobId', (req, res) => {
    const job = orchestrator.jobs.get(req.params.jobId);
    if (!job) return res.status(404).json({ ok: false, error: 'Job not found.' });
    res.json(job);
  });


  return router;
}


module.exports = {
  PIPELINE,
  createProductionOrchestrator,
  createProductionOrchestratorRouter
};

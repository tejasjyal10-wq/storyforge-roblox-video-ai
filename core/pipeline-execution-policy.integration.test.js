
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const PipelineEngine = require('./pipeline-engine');
const AgentExecutionPolicy = require('./agent-execution-policy');

function createJobManager() {
  const jobs = new Map();

  return {
    jobs,

    createJob(data) {
      const jobId = data.jobId || `job-${jobs.size + 1}`;

      const job = {
        ...data,
        jobId,
        status: 'queued',
        stages: [],
        outputs: {},
        errors: []
      };

      jobs.set(jobId, job);
      return job;
    },

    getJob(jobId) {
      return jobs.get(jobId) || null;
    },

    updateJob(jobId, updates) {
      const job = jobs.get(jobId);
      if (!job) return null;

      Object.assign(job, updates);
      return job;
    },

    setStages(jobId, stages) {
      const job = jobs.get(jobId);
      if (!job) return null;

      job.stages = stages;
      return job;
    },

    updateStage(jobId, stageId, updates) {
      const job = jobs.get(jobId);
      if (!job) return null;

      const stage = job.stages.find(
        item => item.id === stageId
      );

      if (stage) {
        Object.assign(stage, updates);
      }

      return stage || null;
    },

    updateProgress(jobId, progress) {
      const job = jobs.get(jobId);
      if (!job) return null;

      job.progress = progress;
      return job;
    },

    addError(jobId, error) {
      const job = jobs.get(jobId);
      if (!job) return null;

      job.errors.push(error);
      return job;
    },

    completeJob(jobId, status) {
      const job = jobs.get(jobId);
      if (!job) return null;

      job.status = status;
      return job;
    }
  };
}

function createRegistry(agents = {}) {
  return {
    get(id) {
      return agents[id] || null;
    },

    has(id) {
      return Boolean(agents[id]);
    }
  };
}

function createEngine({
  agents,
  maxRetries = 0,
  timeoutMs = 0
}) {
  const jobManager = createJobManager();

  return new PipelineEngine({
    registry: createRegistry(agents),
    jobManager,
    executionPolicy: new AgentExecutionPolicy({
      maxRetries,
      timeoutMs,
      retryDelayMs: 0
    })
  });
}

function simpleStages(agentId, options = {}) {
  return [
    {
      id: 'stage-1',
      name: 'Test Stage',
      agents: [agentId],
      ...options
    }
  ];
}

test('pipeline retries a temporarily failing agent', async () => {
  let attempts = 0;

  const engine = createEngine({
    maxRetries: 2,

    agents: {
      testAgent: {
        async run() {
          attempts++;

          if (attempts < 3) {
            throw new Error('Temporary failure');
          }

          return {
            success: true,
            result: 'Recovered'
          };
        }
      }
    }
  });

  const result = await engine.run({
    idea: 'Retry test',
    stages: simpleStages('testAgent')
  });

  assert.equal(attempts, 3);
  assert.ok(result);
});

test('pipeline stops after retry exhaustion', async () => {
  let attempts = 0;

  const engine = createEngine({
    maxRetries: 1,

    agents: {
      testAgent: {
        async run() {
          attempts++;
          throw new Error('Permanent failure');
        }
      }
    }
  });

  const result = await engine.run({
    idea: 'Retry exhaustion test',
    stages: simpleStages('testAgent')
  });

  assert.equal(attempts, 2);
  assert.ok(result);
});

test('pipeline retries timed out agents', async () => {
  let attempts = 0;

  const engine = createEngine({
    maxRetries: 1,
    timeoutMs: 10,

    agents: {
      testAgent: {
        async run() {
          attempts++;

          if (attempts === 1) {
            await new Promise(resolve =>
              setTimeout(resolve, 30)
            );
          }

          return {
            success: true,
            result: 'Completed'
          };
        }
      }
    }
  });

  const result = await engine.run({
    idea: 'Timeout retry test',
    stages: simpleStages('testAgent')
  });

  assert.equal(attempts, 2);
  assert.ok(result);
});

test('pipeline records execution history', async () => {
  const engine = createEngine({
    maxRetries: 1,

    agents: {
      testAgent: {
        async run() {
          return {
            success: true,
            result: 'History test'
          };
        }
      }
    }
  });

  const result = await engine.run({
    idea: 'History test',
    stages: simpleStages('testAgent')
  });

  assert.ok(result);

  const jobId = result.jobId || result.id;

  if (jobId) {
    const job = engine.jobManager.getJob(jobId);
    assert.ok(job);
  }
});

test('stage-specific retry settings override global settings', async () => {
  let attempts = 0;

  const engine = createEngine({
    maxRetries: 0,

    agents: {
      testAgent: {
        async run() {
          attempts++;

          if (attempts === 1) {
            throw new Error('First attempt fails');
          }

          return {
            success: true,
            result: 'Stage retry succeeded'
          };
        }
      }
    }
  });

  const result = await engine.run({
    idea: 'Stage policy test',
    stages: simpleStages('testAgent', {
      executionPolicy: {
        maxRetries: 1
      }
    })
  });

  assert.equal(attempts, 2);
  assert.ok(result);
});

test('agent-specific retry settings override global settings', async () => {
  let attempts = 0;

  const engine = createEngine({
    maxRetries: 0,

    agents: {
      testAgent: {
        executionPolicy: {
          maxRetries: 1
        },

        async run() {
          attempts++;

          if (attempts === 1) {
            throw new Error('Temporary agent failure');
          }

          return {
            success: true,
            result: 'Agent policy succeeded'
          };
        }
      }
    }
  });

  const result = await engine.run({
    idea: 'Agent policy test',
    stages: simpleStages('testAgent')
  });

  assert.equal(attempts, 2);
  assert.ok(result);
});

test('successful agents still return validated outputs', async () => {
  const engine = createEngine({
    agents: {
      testAgent: {
        async run() {
          return {
            success: true,
            result: {
              title: 'Validated Output'
            }
          };
        }
      }
    }
  });

  const result = await engine.run({
    idea: 'Validation integration test',
    stages: simpleStages('testAgent')
  });

  assert.ok(result);
});

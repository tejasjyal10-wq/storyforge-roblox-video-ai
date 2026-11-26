
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const PipelineEngine = require('./pipeline-engine');
const ProductionOutputValidator = require('./production-output-validator');

/**
 * Lightweight test registry.
 */
class TestRegistry {
  constructor(agents = {}) {
    this.agents = agents;
  }

  get(id) {
    return this.agents[id] || null;
  }
}

/**
 * Lightweight JobManager for integration testing.
 */
class TestJobManager {
  constructor() {
    this.jobs = new Map();
    this.counter = 0;
  }

  createJob({ idea, input, type }) {
    const jobId = `test-job-${++this.counter}`;

    const job = {
      jobId,
      idea,
      input,
      type,
      status: 'pending',
      progress: 0,
      stages: [],
      outputs: {},
      errors: [],
      createdAt: Date.now()
    };

    this.jobs.set(jobId, job);

    return job;
  }

  getJob(jobId) {
    return this.jobs.get(jobId) || null;
  }

  setStages(jobId, stages) {
    this.jobs.get(jobId).stages = stages;
  }

  updateJob(jobId, updates) {
    Object.assign(this.jobs.get(jobId), updates);
  }

  updateStage(jobId, stageId, updates) {
    const job = this.jobs.get(jobId);
    const stage = job.stages.find(item => item.id === stageId);

    if (stage) {
      Object.assign(stage, updates);
    }
  }

  setOutput(jobId, stageId, output) {
    this.jobs.get(jobId).outputs[stageId] = output;
  }

  addError(jobId, error, stageId) {
    this.jobs.get(jobId).errors.push({
      stageId,
      message: error.message
    });
  }

  updateProgress(jobId) {
    const job = this.jobs.get(jobId);

    const completed = job.stages.filter(
      stage => stage.status === 'completed'
    ).length;

    job.progress = job.stages.length
      ? Math.round((completed / job.stages.length) * 100)
      : 0;
  }

  completeJob(jobId, status) {
    this.jobs.get(jobId).status = status;
  }
}

function createEngine(agents = {}, validator) {
  const registry = new TestRegistry(agents);
  const jobManager = new TestJobManager();

  const engine = new PipelineEngine({
    registry,
    jobManager,
    validator
  });

  return {
    engine,
    jobManager
  };
}

test('runs stages sequentially', async () => {
  const executionOrder = [];

  const { engine } = createEngine({
    first: {
      id: 'first',
      name: 'First Agent',
      run: async () => {
        executionOrder.push('first');
        return { result: 'first' };
      }
    },
    second: {
      id: 'second',
      name: 'Second Agent',
      run: async () => {
        executionOrder.push('second');
        return { result: 'second' };
      }
    }
  });

  const job = await engine.run({
    idea: 'A forest adventure',
    stages: [
      { id: 'stage-one', agents: ['first'] },
      { id: 'stage-two', agents: ['second'] }
    ]
  });

  assert.deepEqual(executionOrder, ['first', 'second']);
  assert.equal(job.status, 'completed');
});

test('passes previous output to the next agent', async () => {
  let receivedContext;

  const { engine } = createEngine({
    first: {
      id: 'first',
      run: async () => ({
        story: 'A young explorer discovers a forest.'
      })
    },
    second: {
      id: 'second',
      run: async context => {
        receivedContext = context;
        return {
          screenplay: 'The explorer enters the forest.'
        };
      }
    }
  });

  await engine.run({
    idea: 'Forest adventure',
    stages: [
      { id: 'story', agents: ['first'] },
      { id: 'screenplay', agents: ['second'] }
    ]
  });

  assert.equal(
    receivedContext.previousOutput.story,
    'A young explorer discovers a forest.'
  );

  assert.ok(receivedContext.stageOutputs.story);
});

test('runs multiple agents sequentially inside one stage', async () => {
  const order = [];

  const { engine } = createEngine({
    agentA: {
      id: 'agentA',
      run: async () => {
        order.push('A');
        return { a: 1 };
      }
    },
    agentB: {
      id: 'agentB',
      run: async () => {
        order.push('B');
        return { b: 2 };
      }
    }
  });

  const job = await engine.run({
    idea: 'Test multiple agents',
    stages: [
      {
        id: 'combined-stage',
        agents: ['agentA', 'agentB']
      }
    ]
  });

  assert.deepEqual(order, ['A', 'B']);
  assert.equal(job.status, 'completed');
  assert.deepEqual(
    job.outputs['combined-stage'],
    {
      agentA: { a: 1 },
      agentB: { b: 2 }
    }
  );
});

test('stops when an agent returns empty output', async () => {
  let secondAgentExecuted = false;

  const { engine } = createEngine({
    first: {
      id: 'first',
      run: async () => null
    },
    second: {
      id: 'second',
      run: async () => {
        secondAgentExecuted = true;
        return { result: 'should not run' };
      }
    }
  });

  const job = await engine.run({
    idea: 'Test invalid output',
    stages: [
      { id: 'stage-one', agents: ['first'] },
      { id: 'stage-two', agents: ['second'] }
    ]
  });

  assert.equal(job.status, 'failed');
  assert.equal(secondAgentExecuted, false);
  assert.equal(job.stages[0].status, 'failed');
  assert.equal(job.stages[1].status, 'skipped');
});

test('records agent validation results', async () => {
  const { engine } = createEngine({
    storyAgent: {
      id: 'storyAgent',
      run: async () => ({
        title: 'Forest Adventure'
      })
    }
  });

  const job = await engine.run({
    idea: 'Forest adventure',
    stages: [
      { id: 'story-stage', agents: ['storyAgent'] }
    ]
  });

  assert.equal(job.status, 'completed');
  assert.equal(
    job.stages[0].agentValidations[0].valid,
    true
  );
  assert.equal(job.stages[0].validation.valid, true);
});

test('stops when custom stage validation fails', async () => {
  let nextAgentExecuted = false;

  const validator = new ProductionOutputValidator({
    'story-stage': {
      requiredFields: ['title']
    }
  });

  const { engine } = createEngine(
    {
      storyAgent: {
        id: 'storyAgent',
        run: async () => ({
          description: 'Missing title'
        })
      },
      nextAgent: {
        id: 'nextAgent',
        run: async () => {
          nextAgentExecuted = true;
          return { result: true };
        }
      }
    },
    validator
  );

  const job = await engine.run({
    idea: 'Test stage validation',
    stages: [
      { id: 'story-stage', agents: ['storyAgent'] },
      { id: 'next-stage', agents: ['nextAgent'] }
    ]
  });

  assert.equal(job.status, 'failed');
  assert.equal(job.stages[0].status, 'failed');
  assert.equal(nextAgentExecuted, false);
});

test('marks missing agents as unavailable', async () => {
  const { engine } = createEngine({});

  const job = await engine.run({
    idea: 'Unavailable agent test',
    stages: [
      { id: 'missing-stage', agents: ['missingAgent'] }
    ]
  });

  assert.equal(job.status, 'not_ready');
  assert.equal(job.stages[0].status, 'unavailable');
});

test('skips dependent stages when a dependency is unavailable', async () => {
  const { engine } = createEngine({
    availableAgent: {
      id: 'availableAgent',
      run: async () => ({ result: true })
    }
  });

  const job = await engine.run({
    idea: 'Dependency test',
    stages: [
      { id: 'stage-one', agents: ['missingAgent'] },
      {
        id: 'stage-two',
        agents: ['availableAgent'],
        dependsOn: ['stage-one']
      }
    ]
  });

  assert.equal(job.status, 'not_ready');
  assert.equal(job.stages[0].status, 'unavailable');
  assert.equal(job.stages[1].status, 'skipped');
});

test('rejects duplicate stage IDs', async () => {
  const { engine } = createEngine({});

  await assert.rejects(
    () => engine.run({
      idea: 'Duplicate stage test',
      stages: [
        { id: 'duplicate', agents: ['agentA'] },
        { id: 'duplicate', agents: ['agentB'] }
      ]
    }),
    /Duplicate stage ID/
  );
});

test('rejects unknown dependencies', async () => {
  const { engine } = createEngine({});

  await assert.rejects(
    () => engine.run({
      idea: 'Unknown dependency test',
      stages: [
        {
          id: 'stage-one',
          agents: ['agentA'],
          dependsOn: ['unknown-stage']
        }
      ]
    }),
    /depends on unknown stage/
  );
});

test('rejects an invalid story idea', async () => {
  const { engine } = createEngine({});

  await assert.rejects(
    () => engine.run({
      idea: '   ',
      stages: [{ id: 'stage-one', agents: ['agentA'] }]
    }),
    /valid story idea/
  );
});

test('supports legacy single-agent stage format', async () => {
  const { engine } = createEngine({
    legacyAgent: {
      id: 'legacyAgent',
      name: 'Legacy Agent',
      run: async () => ({
        result: 'legacy output'
      })
    }
  });

  const job = await engine.run({
    idea: 'Legacy format test',
    stages: [
      {
        id: 'legacyAgent',
      name: 'Legacy Agent'
      }
    ]
  });

  assert.equal(job.status, 'completed');
  assert.equal(job.stages[0].status, 'completed');
});
    

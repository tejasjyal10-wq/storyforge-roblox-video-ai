
'use strict';

const assert = require('assert');

const JobManager = require('../core/job-manager');
const AgentRegistry = require('../core/agent-registry');
const PipelineEngine = require('../core/pipeline-engine');

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`PASS: ${name}`);
  } catch (error) {
    failed++;
    console.error(`FAIL: ${name}`);
    console.error(error);
  }
}

async function main() {
  console.log('\nStoryForge Core Engine Tests');
  console.log('==========================\n');

  await test('Job Manager creates jobs', () => {
    const manager = new JobManager();
    const job = manager.createJob({ idea: 'A forest adventure' });

    assert.ok(job.jobId);
    assert.strictEqual(job.status, 'queued');
    assert.strictEqual(job.idea, 'A forest adventure');
    assert.strictEqual(manager.getJob(job.jobId), job);
  });

  await test('Job Manager updates job status', () => {
    const manager = new JobManager();
    const job = manager.createJob({ idea: 'Test' });

    manager.updateJob(job.jobId, {
      status: 'running'
    });

    assert.strictEqual(
      manager.getJob(job.jobId).status,
      'running'
    );
  });

  await test('Job Manager tracks progress', () => {
    const manager = new JobManager();
    const job = manager.createJob({ idea: 'Test' });

    manager.setStages(job.jobId, [
      { id: 'a', status: 'completed' },
      { id: 'b', status: 'pending' }
    ]);

    const progress = manager.updateProgress(job.jobId);

    assert.strictEqual(progress, 50);
    assert.strictEqual(manager.getJob(job.jobId).progress, 50);
  });

  await test('Agent Registry registers and retrieves agents', () => {
    const registry = new AgentRegistry();

    registry.register('testAgent', {
      name: 'Test Agent',
      run: async () => ({ result: 'ok' })
    });

    assert.strictEqual(registry.has('testAgent'), true);
    assert.strictEqual(registry.get('testAgent').name, 'Test Agent');
    assert.strictEqual(registry.count, 1);
  });

  await test('Agent Registry rejects duplicate IDs', () => {
    const registry = new AgentRegistry();

    registry.register('testAgent', {
      run: async () => 'first'
    });

    assert.throws(() => {
      registry.register('testAgent', {
        run: async () => 'second'
      });
    }, /already registered/);
  });

  await test('Agent Registry rejects agents without run()', () => {
    const registry = new AgentRegistry();

    assert.throws(() => {
      registry.register('invalidAgent', {});
    }, /run\(\) method/);
  });

  await test('Pipeline Engine executes agents in order', async () => {
    const manager = new JobManager();
    const registry = new AgentRegistry();
    const engine = new PipelineEngine({
      registry,
      jobManager: manager
    });

    const sequence = [];

    registry.register('first', {
      run: async (context) => {
        sequence.push('first');
        return { message: context.idea };
      }
    });

    registry.register('second', {
      run: async (context) => {
        sequence.push('second');
        return {
          received: context.first.message
        };
      }
    });

    const job = await engine.run({
      idea: 'A robot discovers a forest',
      stages: [
        { id: 'first' },
        { id: 'second' }
      ]
    });

    assert.deepStrictEqual(sequence, ['first', 'second']);
    assert.strictEqual(job.status, 'completed');
    assert.strictEqual(job.progress, 100);
    assert.deepStrictEqual(job.outputs.second, {
      received: 'A robot discovers a forest'
    });
  });

  await test('Pipeline Engine stops after agent failure', async () => {
    const manager = new JobManager();
    const registry = new AgentRegistry();
    const engine = new PipelineEngine({
      registry,
      jobManager: manager
    });

    let thirdAgentCalled = false;

    registry.register('first', {
      run: async () => ({ ok: true })
    });

    registry.register('second', {
      run: async () => {
        throw new Error('Intentional test failure');
      }
    });

    registry.register('third', {
      run: async () => {
        thirdAgentCalled = true;
        return { ok: true };
      }
    });

    const job = await engine.run({
      idea: 'Failure handling test',
      stages: [
        { id: 'first' },
        { id: 'second' },
        { id: 'third' }
      ]
    });

    assert.strictEqual(job.status, 'failed');
    assert.strictEqual(job.stages[1].status, 'failed');
    assert.strictEqual(job.stages[2].status, 'skipped');
    assert.strictEqual(thirdAgentCalled, false);
    assert.strictEqual(job.errors.length, 1);
  });

  await test('Pipeline Engine detects unavailable agents', async () => {
    const manager = new JobManager();
    const registry = new AgentRegistry();
    const engine = new PipelineEngine({
      registry,
      jobManager: manager
    });

    registry.register('available', {
      run: async () => ({ success: true })
    });

    const job = await engine.run({
      idea: 'Availability test',
      stages: [
        { id: 'available' },
        { id: 'missing' }
      ]
    });

    assert.strictEqual(job.status, 'partial');
    assert.strictEqual(job.stages[0].status, 'completed');
    assert.strictEqual(job.stages[1].status, 'unavailable');
  });

  await test('Pipeline Engine rejects an empty idea', async () => {
    const engine = new PipelineEngine({
      registry: new AgentRegistry(),
      jobManager: new JobManager()
    });

    await assert.rejects(
      () => engine.run({
        idea: '',
        stages: [{ id: 'test' }]
      }),
      /valid story idea/
    );
  });

  console.log('\n==========================');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}`);
  console.log('==========================\n');

  if (failed > 0) {
    process.exitCode = 1;
  } else {
    console.log('CORE ENGINE: ALL TESTS PASSED');
  }
}

main().catch(error => {
  console.error('Unexpected test error:', error);
  process.exitCode = 1;
});
             

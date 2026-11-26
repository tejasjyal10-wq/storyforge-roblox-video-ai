
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const AgentExecutionPolicy = require('./agent-execution-policy');

test('executes successfully without retries', async () => {
  const policy = new AgentExecutionPolicy();

  const result = await policy.execute(async () => 'success');

  assert.equal(result.success, true);
  assert.equal(result.result, 'success');
  assert.equal(result.attempts, 1);
  assert.equal(result.history.length, 1);
});

test('provides attempt information to tasks', async () => {
  const policy = new AgentExecutionPolicy({
    maxRetries: 2
  });

  const result = await policy.execute(
    async ({ attempt, maxAttempts }) => ({
      attempt,
      maxAttempts
    })
  );

  assert.equal(result.result.attempt, 1);
  assert.equal(result.result.maxAttempts, 3);
});

test('retries after a failure', async () => {
  const policy = new AgentExecutionPolicy({
    maxRetries: 2
  });

  let executions = 0;

  const result = await policy.execute(async () => {
    executions++;

    if (executions < 2) {
      throw new Error('Temporary failure');
    }

    return 'recovered';
  });

  assert.equal(result.success, true);
  assert.equal(result.result, 'recovered');
  assert.equal(result.attempts, 2);
  assert.equal(executions, 2);
});

test('fails after exhausting retry attempts', async () => {
  const policy = new AgentExecutionPolicy({
    maxRetries: 2
  });

  let executions = 0;

  await assert.rejects(
    () => policy.execute(async () => {
      executions++;
      throw new Error('Persistent failure');
    }),
    error => {
      assert.equal(error.message, 'Persistent failure');
      assert.equal(error.attempts, 3);
      assert.equal(error.history.length, 3);
      return true;
    }
  );

  assert.equal(executions, 3);
});

test('records failed attempts in history', async () => {
  const policy = new AgentExecutionPolicy({
    maxRetries: 1
  });

  let executions = 0;

  const result = await policy.execute(async () => {
    executions++;

    if (executions === 1) {
      throw new Error('First attempt failed');
    }

    return 'success';
  });

  assert.equal(result.history.length, 2);
  assert.equal(result.history[0].status, 'failed');
  assert.equal(result.history[1].status, 'completed');
});

test('supports custom retry conditions', async () => {
  const policy = new AgentExecutionPolicy({
    maxRetries: 3,
    retryOn: error => error.message === 'Temporary'
  });

  let executions = 0;

  await assert.rejects(
    () => policy.execute(async () => {
      executions++;
      throw new Error('Permanent');
    })
  );

  assert.equal(executions, 1);
});

test('stops retrying when retryOn returns false', async () => {
  const policy = new AgentExecutionPolicy({
    maxRetries: 5,
    retryOn: () => false
  });

  let executions = 0;

  await assert.rejects(
    () => policy.execute(async () => {
      executions++;
      throw new Error('Do not retry');
    })
  );

  assert.equal(executions, 1);
});

test('supports execution-specific retry overrides', async () => {
  const policy = new AgentExecutionPolicy({
    maxRetries: 0
  });

  let executions = 0;

  const result = await policy.execute(
    async () => {
      executions++;

      if (executions === 1) {
        throw new Error('Retry required');
      }

      return 'success';
    },
    {
      maxRetries: 1
    }
  );

  assert.equal(result.success, true);
  assert.equal(executions, 2);
});

test('supports retry delays', async () => {
  const policy = new AgentExecutionPolicy({
    maxRetries: 1,
    retryDelayMs: 10
  });

  let executions = 0;

  const result = await policy.execute(async () => {
    executions++;

    if (executions === 1) {
      throw new Error('Retry');
    }

    return 'success';
  });

  assert.equal(result.success, true);
  assert.equal(executions, 2);
});

test('times out an execution', async () => {
  const policy = new AgentExecutionPolicy({
    timeoutMs: 20
  });

  await assert.rejects(
    () => policy.execute(
      () => new Promise(resolve => setTimeout(resolve, 100))
    ),
    error => {
      assert.equal(error.code, 'EXECUTION_TIMEOUT');
      assert.match(error.message, /timed out/);
      return true;
    }
  );
});

test('retries timeout failures when configured', async () => {
  const policy = new AgentExecutionPolicy({
    maxRetries: 1,
    timeoutMs: 10
  });

  let executions = 0;

  await assert.rejects(
    () => policy.execute(async () => {
      executions++;

      return new Promise(resolve =>
        setTimeout(resolve, 50)
      );
    })
  );

  assert.equal(executions, 2);
});

test('rejects invalid retry configuration', () => {
  assert.throws(
    () => new AgentExecutionPolicy({
      maxRetries: -1
    }),
    /maxRetries/
  );
});

test('rejects invalid timeout configuration', () => {
  assert.throws(
    () => new AgentExecutionPolicy({
      timeoutMs: -1
    }),
    /timeoutMs/
  );
});

test('rejects invalid retry delay configuration', () => {
  assert.throws(
    () => new AgentExecutionPolicy({
      retryDelayMs: -1
    }),
    /retryDelayMs/
  );
});

test('rejects invalid retry condition', () => {
  assert.throws(
    () => new AgentExecutionPolicy({
      retryOn: 'invalid'
    }),
    /retryOn/
  );
});

test('rejects a non-function task', async () => {
  const policy = new AgentExecutionPolicy();

  await assert.rejects(
    () => policy.execute('not a task'),
    /task must be a function/
  );
});

test('rejects invalid per-execution options', async () => {
  const policy = new AgentExecutionPolicy();

  await assert.rejects(
    () => policy.execute(
      async () => 'success',
      {
        maxRetries: -1
      }
    ),
    /maxRetries/
  );
});
     


'use strict';

/**
 * StoryForge Agent Execution Policy
 *
 * Provides:
 * - Execution timeout
 * - Configurable retry attempts
 * - Retry delays
 * - Retry condition control
 * - Execution attempt history
 *
 * A timeout does not forcibly cancel the underlying agent operation.
 */

class AgentExecutionPolicy {
  constructor({
    maxRetries = 0,
    timeoutMs = 0,
    retryDelayMs = 0,
    retryOn = null
  } = {}) {
    if (!Number.isInteger(maxRetries) || maxRetries < 0) {
      throw new Error('maxRetries must be a non-negative integer.');
    }

    if (!Number.isFinite(timeoutMs) || timeoutMs < 0) {
      throw new Error('timeoutMs must be a non-negative number.');
    }

    if (!Number.isFinite(retryDelayMs) || retryDelayMs < 0) {
      throw new Error('retryDelayMs must be a non-negative number.');
    }

    if (retryOn !== null && typeof retryOn !== 'function') {
      throw new Error('retryOn must be a function or null.');
    }

    this.maxRetries = maxRetries;
    this.timeoutMs = timeoutMs;
    this.retryDelayMs = retryDelayMs;
    this.retryOn = retryOn;
  }

  delay(ms) {
    if (ms <= 0) {
      return Promise.resolve();
    }

    return new Promise(resolve => {
      setTimeout(resolve, ms);
    });
  }

  async execute(task, options = {}) {
    if (typeof task !== 'function') {
      throw new Error('Execution task must be a function.');
    }

    const maxRetries = options.maxRetries ?? this.maxRetries;
    const timeoutMs = options.timeoutMs ?? this.timeoutMs;
    const retryDelayMs = options.retryDelayMs ?? this.retryDelayMs;
    const retryOn = options.retryOn ?? this.retryOn;

    if (!Number.isInteger(maxRetries) || maxRetries < 0) {
      throw new Error('maxRetries must be a non-negative integer.');
    }

    if (!Number.isFinite(timeoutMs) || timeoutMs < 0) {
      throw new Error('timeoutMs must be a non-negative number.');
    }

    if (!Number.isFinite(retryDelayMs) || retryDelayMs < 0) {
      throw new Error('retryDelayMs must be a non-negative number.');
    }

    if (retryOn !== null && typeof retryOn !== 'function') {
      throw new Error('retryOn must be a function or null.');
    }

    const history = [];
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      const startedAt = Date.now();

      try {
        const result = await this.runWithTimeout(
          () => task({
            attempt,
            maxAttempts: maxRetries + 1
          }),
          timeoutMs
        );

        history.push({
          attempt,
          status: 'completed',
          startedAt,
          completedAt: Date.now()
        });

        return {
          success: true,
          result,
          attempts: attempt,
          history
        };
      } catch (error) {
        lastError = error;

        history.push({
          attempt,
          status: 'failed',
          startedAt,
          completedAt: Date.now(),
          error: error.message || 'Execution failed.'
        });

        if (attempt > maxRetries) {
          break;
        }

        let shouldRetry = true;

        if (retryOn) {
          try {
            shouldRetry = retryOn(error, attempt);
          } catch (retryCheckError) {
            lastError = retryCheckError;
            shouldRetry = false;
          }
        }

        if (!shouldRetry) {
          break;
        }

        await this.delay(retryDelayMs);
      }
    }

    const finalError = new Error(
      lastError?.message || 'Agent execution failed.'
    );
    if (lastError?.code) {
  finalError.code = lastError.code;
    }

    finalError.attempts = history.length;
    finalError.history = history;
    finalError.cause = lastError;

    throw finalError;
  }

  runWithTimeout(task, timeoutMs) {
    if (!timeoutMs) {
      return Promise.resolve().then(task);
    }

    return new Promise((resolve, reject) => {
      let settled = false;

      const timer = setTimeout(() => {
        if (settled) return;

        settled = true;

        const error = new Error(
          `Execution timed out after ${timeoutMs}ms.`
        );

        error.code = 'EXECUTION_TIMEOUT';

        reject(error);
      }, timeoutMs);

      Promise.resolve()
        .then(task)
        .then(result => {
          if (settled) return;

          settled = true;
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          if (settled) return;

          settled = true;
          clearTimeout(timer);
          reject(error);
        });
    });
  }
}

module.exports = AgentExecutionPolicy;
              

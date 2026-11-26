
'use strict';

class PipelineEngine {
  constructor({ registry, jobManager }) {
    if (!registry) {
      throw new Error('PipelineEngine requires an AgentRegistry.');
    }

    if (!jobManager) {
      throw new Error('PipelineEngine requires a JobManager.');
    }

    this.registry = registry;
    this.jobManager = jobManager;
  }

  async run({ idea, input = {}, stages = [] } = {}) {
    if (!idea || typeof idea !== 'string' || !idea.trim()) {
      throw new Error('A valid story idea is required.');
    }

    if (!Array.isArray(stages) || stages.length === 0) {
      throw new Error('Pipeline stages must be provided.');
    }

    const job = this.jobManager.createJob({
      idea: idea.trim(),
      input,
      type: 'story-production'
    });

    const stageRecords = stages.map(stage => ({
      id: stage.id,
      name: stage.name || stage.id,
      status: this.registry.has(stage.id)
        ? 'pending'
        : 'unavailable'
    }));

    this.jobManager.setStages(job.jobId, stageRecords);
    this.jobManager.updateJob(job.jobId, {
      status: 'running'
    });

    let context = {
      idea: idea.trim(),
      input,
      jobId: job.jobId
    };

    let stopped = false;

    for (const stage of stages) {
      const agent = this.registry.get(stage.id);
      const record = this.jobManager
        .getJob(job.jobId)
        .stages.find(s => s.id === stage.id);

      if (!agent) continue;

      if (stopped) {
        record.status = 'skipped';
        continue;
      }

      this.jobManager.updateStage(job.jobId, stage.id, {
        status: 'running',
        startedAt: Date.now()
      });

      try {
        const output = await agent.run(context);

        if (output === undefined || output === null) {
          throw new Error(`${agent.name} returned no output.`);
        }

        this.jobManager.setOutput(
          job.jobId,
          stage.id,
          output
        );

        context = {
          ...context,
          [stage.id]: output,
          previousOutput: output
        };

        this.jobManager.updateStage(job.jobId, stage.id, {
          status: 'completed',
          finishedAt: Date.now()
        });

      } catch (error) {
        this.jobManager.updateStage(job.jobId, stage.id, {
          status: 'failed',
          finishedAt: Date.now(),
          error: error.message || 'Agent failed.'
        });

        this.jobManager.addError(
          job.jobId,
          error,
          stage.id
        );

        stopped = true;
      }

      this.jobManager.updateProgress(job.jobId);
    }

    const finalJob = this.jobManager.getJob(job.jobId);

    const failed = finalJob.stages.some(
      stage => stage.status === 'failed'
    );

    const unavailable = finalJob.stages.some(
      stage => stage.status === 'unavailable'
    );

    const completed = finalJob.stages.filter(
      stage => stage.status === 'completed'
    ).length;

    let finalStatus;

    if (failed) {
      finalStatus = 'failed';
    } else if (unavailable) {
      finalStatus = completed > 0 ? 'partial' : 'not_ready';
    } else {
      finalStatus = 'completed';
    }

    this.jobManager.completeJob(
      job.jobId,
      finalStatus
    );

    return this.jobManager.getJob(job.jobId);
  }
}

module.exports = PipelineEngine;

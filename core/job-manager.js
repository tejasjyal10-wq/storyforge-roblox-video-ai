'use strict';

const { EventEmitter } = require('events');

class JobManager extends EventEmitter {
  constructor() {
    super();
    this.jobs = new Map();
  }

  createJob(input = {}) {
    const jobId = `sf_${Date.now()}_${Math.random()
      .toString(36).slice(2, 8)}`;

    const now = Date.now();

    const job = {
      jobId,
      type: input.type || 'story-production',
      idea: input.idea || input.prompt || '',
      status: 'queued',
      progress: 0,
      createdAt: now,
      updatedAt: now,
      stages: [],
      outputs: {},
      errors: [],
      metadata: input.metadata || {}
    };

    this.jobs.set(jobId, job);
    this.emit('job:created', job);

    return job;
  }

  getJob(jobId) {
    return this.jobs.get(jobId) || null;
  }

  listJobs() {
    return Array.from(this.jobs.values())
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  updateJob(jobId, updates = {}) {
    const job = this.getJob(jobId);
    if (!job) return null;

    Object.assign(job, updates, {
      updatedAt: Date.now()
    });

    this.emit('job:updated', job);
    return job;
  }

  setStages(jobId, stages) {
    const job = this.getJob(jobId);
    if (!job) return null;

    job.stages = stages.map(stage => ({ ...stage }));
    job.updatedAt = Date.now();

    this.emit('job:updated', job);
    return job;
  }

  updateStage(jobId, stageId, updates = {}) {
    const job = this.getJob(jobId);
    if (!job) return null;

    const stage = job.stages.find(s => s.id === stageId);
    if (!stage) return null;

    Object.assign(stage, updates);
    job.updatedAt = Date.now();

    this.emit('stage:updated', {
      jobId,
      stage,
      job
    });

    return stage;
  }

  setOutput(jobId, stageId, output) {
    const job = this.getJob(jobId);
    if (!job) return null;

    job.outputs[stageId] = output;
    job.updatedAt = Date.now();

    this.emit('job:updated', job);
    return job;
  }

  addError(jobId, error, stageId = null) {
    const job = this.getJob(jobId);
    if (!job) return null;

    job.errors.push({
      stage: stageId,
      message: error?.message || String(error),
      timestamp: Date.now()
    });

    job.updatedAt = Date.now();
    this.emit('job:error', job);

    return job;
  }

  updateProgress(jobId) {
    const job = this.getJob(jobId);
    if (!job || job.stages.length === 0) return 0;

    const completed = job.stages.filter(
      s => s.status === 'completed'
    ).length;

    const progress = Math.round(
      (completed / job.stages.length) * 100
    );

    job.progress = progress;
    job.updatedAt = Date.now();

    this.emit('job:updated', job);
    return progress;
  }

  completeJob(jobId, status = 'completed') {
    const job = this.getJob(jobId);
    if (!job) return null;

    job.status = status;
    job.progress = status === 'completed' ? 100 : job.progress;
    job.finishedAt = Date.now();
    job.updatedAt = Date.now();

    this.emit('job:completed', job);
    return job;
  }

  deleteJob(jobId) {
    const job = this.getJob(jobId);
    if (!job) return false;

    this.jobs.delete(jobId);
    this.emit('job:deleted', job);
    return true;
  }
}

module.exports = JobManager;
      

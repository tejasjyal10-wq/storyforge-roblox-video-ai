'use strict';

const {
  getProductionStages
} = require('./production-pipeline-definition');

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

  // Resolve agents while supporting both existing registry implementations.
  resolveAgent(agentId) {
    let agent = null;

    if (typeof this.registry.getAgent === 'function') {
      agent = this.registry.getAgent(agentId);
    }

    if (!agent && typeof this.registry.get === 'function') {
      agent = this.registry.get(agentId);
    }

    if (!agent) {
      return null;
    }

    if (agent.enabled === false) {
      return null;
    }

    let handler = null;

    if (typeof agent.run === 'function') {
      handler = context => agent.run(context);
    } else if (typeof agent.handler === 'function') {
      handler = context => agent.handler(context);
    } else if (
      typeof this.registry.getHandler === 'function'
    ) {
      const registeredHandler = this.registry.getHandler(agentId);

      if (typeof registeredHandler === 'function') {
        handler = context => registeredHandler(context);
      }
    }

    if (!handler) {
      return null;
    }

    return {
      id: agentId,
      name: agent.name || agentId,
      run: handler
    };
  }

  normalizeStages(stages) {
    const source = stages.length > 0
      ? stages
      : getProductionStages();

    return source.map((stage, index) => ({
      id: stage.id || `stage-${index + 1}`,
      name: stage.name || stage.id || `Stage ${index + 1}`,
      order: stage.order || index + 1,
      agents: Array.isArray(stage.agents)
        ? [...stage.agents]
        : [stage.id],
      dependsOn: Array.isArray(stage.dependsOn)
        ? [...stage.dependsOn]
        : [],
      outputKey: stage.outputKey || stage.id,
      requiredOutputs: Array.isArray(stage.requiredOutputs)
        ? [...stage.requiredOutputs]
        : []
    }));
  }

  validateStages(stages) {
    const stageIds = new Set();

    for (const stage of stages) {
      if (!stage.id) {
        throw new Error('Every pipeline stage requires an ID.');
      }

      if (stageIds.has(stage.id)) {
        throw new Error(`Duplicate pipeline stage "${stage.id}".`);
      }

      stageIds.add(stage.id);

      if (!stage.agents.length) {
        throw new Error(
          `Stage "${stage.id}" must have at least one agent.`
        );
      }
    }

    for (const stage of stages) {
      for (const dependency of stage.dependsOn) {
        if (!stageIds.has(dependency)) {
          throw new Error(
            `Stage "${stage.id}" has an unknown dependency "${dependency}".`
          );
        }
      }
    }
  }

  async run({
    idea,
    input = {},
    stages = []
  } = {}) {
    if (!idea || typeof idea !== 'string' || !idea.trim()) {
      throw new Error('A valid story idea is required.');
    }

    if (!Array.isArray(stages)) {
      throw new Error('Pipeline stages must be an array.');
    }

    const normalizedStages = this.normalizeStages(stages);

    if (normalizedStages.length === 0) {
      throw new Error('Pipeline stages must be provided.');
    }

    this.validateStages(normalizedStages);

    const prepared = normalizedStages.map(stage => {
      const agents = stage.agents.map(agentId => ({
        id: agentId,
        agent: this.resolveAgent(agentId)
      }));

      return {
        ...stage,
        resolvedAgents: agents,
        status: agents.every(item => item.agent)
          ? 'pending'
          : 'unavailable'
      };
    });

    const job = this.jobManager.createJob({
      idea: idea.trim(),
      input,
      type: 'story-production'
    });

    const stageRecords = prepared.map(stage => ({
      id: stage.id,
      name: stage.name,
      order: stage.order,
      agents: [...stage.agents],
      status: stage.status,
      output: null,
      error: null,
      startedAt: null,
      finishedAt: null
    }));

    this.jobManager.setStages(job.jobId, stageRecords);

    this.jobManager.updateJob(job.jobId, {
      status: 'running'
    });

    let context = {
      idea: idea.trim(),
      input,
      jobId: job.jobId,
      stageOutputs: {},
      agentOutputs: {},
      previousOutput: null
    };

    let stopped = false;

    for (const stage of prepared) {
      if (stopped) {
        this.jobManager.updateStage(job.jobId, stage.id, {
          status: 'skipped',
          finishedAt: Date.now()
        });
        continue;
      }

      // A stage must never run before its dependencies are complete.
      const dependenciesCompleted = stage.dependsOn.every(
        dependency => {
          const dependencyRecord = this.jobManager
            .getJob(job.jobId)
            .stages.find(record => record.id === dependency);

          return dependencyRecord &&
            dependencyRecord.status === 'completed';
        }
      );

      if (!dependenciesCompleted) {
        this.jobManager.updateStage(job.jobId, stage.id, {
          status: 'skipped',
          finishedAt: Date.now(),
          error: 'Required dependency was not completed.'
        });

        stopped = true;
        continue;
      }

      // An unavailable agent is a hard stop for dependent production.
      const missingAgent = stage.resolvedAgents.find(
        item => !item.agent
      );

      if (missingAgent) {
        this.jobManager.updateStage(job.jobId, stage.id, {
          status: 'unavailable',
          finishedAt: Date.now(),
          error: `Required agent "${missingAgent.id}" is unavailable.`
        });

        stopped = true;
        continue;
      }

      this.jobManager.updateStage(job.jobId, stage.id, {
        status: 'running',
        startedAt: Date.now()
      });

      const stageAgentOutputs = {};

      try {
        // Agents within a stage execute sequentially.
        // Each agent receives the outputs of previous agents.
        for (const item of stage.resolvedAgents) {
          const agentContext = {
            ...context,
            stageId: stage.id,
            stageName: stage.name,
            currentAgent: item.id,
            currentStageOutputs: stageAgentOutputs,
            previousOutput: context.previousOutput
          };

          const output = await item.agent.run(agentContext);

          if (output === undefined || output === null) {
            throw new Error(
              `${item.agent.name} returned no output.`
            );
          }

          stageAgentOutputs[item.id] = output;
          context.agentOutputs[item.id] = output;
        }

        const stageOutput = stage.resolvedAgents.length === 1
          ? stageAgentOutputs[stage.resolvedAgents[0].id]
          : stageAgentOutputs;

        this.jobManager.setOutput(
          job.jobId,
          stage.id,
          stageOutput
        );

        context = {
          ...context,
          [stage.id]: stageOutput,
          [stage.outputKey]: stageOutput,
          stageOutputs: {
            ...context.stageOutputs,
            [stage.id]: stageOutput,
            [stage.outputKey]: stageOutput
          },
          previousOutput: stageOutput
        };

        this.jobManager.updateStage(job.jobId, stage.id, {
          status: 'completed',
          finishedAt: Date.now()
        });

      } catch (error) {
        const message = error.message || 'Pipeline agent failed.';

        this.jobManager.updateStage(job.jobId, stage.id, {
          status: 'failed',
          finishedAt: Date.now(),
          error: message
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

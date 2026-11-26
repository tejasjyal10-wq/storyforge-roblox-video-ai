
'use strict';

const ProductionOutputValidator = require('./production-output-validator');
const {
  getProductionStages
} = require('./production-pipeline-definition');

class PipelineEngine {
  constructor({ registry, jobManager, validator } = {}) {
    if (!registry) {
      throw new Error('PipelineEngine requires an AgentRegistry.');
    }

    if (!jobManager) {
      throw new Error('PipelineEngine requires a JobManager.');
    }

    this.registry = registry;
    this.jobManager = jobManager;

    this.validator = validator || new ProductionOutputValidator();
  }

  /**
   * Resolves an agent from supported registry interfaces.
   */
  resolveAgent(agentId) {
    let agent = null;

    if (typeof this.registry.getAgent === 'function') {
      agent = this.registry.getAgent(agentId);
    }

    if (!agent && typeof this.registry.get === 'function') {
      agent = this.registry.get(agentId);
    }

    if (!agent && typeof this.registry.getHandler === 'function') {
      const handler = this.registry.getHandler(agentId);

      if (handler) {
        agent = {
          id: agentId,
          name: agentId,
          run: handler
        };
      }
    }

    if (!agent) {
      return null;
    }

    if (typeof agent.run !== 'function') {
      return null;
    }

    if (agent.enabled === false) {
      return null;
    }

    return {
      id: agent.id || agentId,
      name: agent.name || agentId,
      run: agent.run.bind(agent)
    };
  }

  /**
   * Converts legacy agent stages and new production stages
   * into a consistent format.
   */
  normalizeStages(stages) {
    const sourceStages =
      stages.length > 0
        ? stages
        : getProductionStages();

    return sourceStages.map(stage => ({
      id: stage.id,
      name: stage.name || stage.id,
      agents: Array.isArray(stage.agents)
        ? [...stage.agents]
        : stage.id
          ? [stage.id]
          : [],
      outputKey: stage.outputKey || stage.id,
      dependsOn: Array.isArray(stage.dependsOn)
        ? [...stage.dependsOn]
        : [],
      requiredOutputs: Array.isArray(stage.requiredOutputs)
        ? [...stage.requiredOutputs]
        : []
    }));
  }

  /**
   * Validates pipeline stage configuration before execution.
   */
  validateStages(stages) {
    const errors = [];
    const stageIds = new Set();

    for (const stage of stages) {
      if (!stage.id || typeof stage.id !== 'string') {
        errors.push('Every stage must have a valid ID.');
        continue;
      }

      if (stageIds.has(stage.id)) {
        errors.push(`Duplicate stage ID: ${stage.id}`);
      }

      stageIds.add(stage.id);

      if (!stage.agents.length) {
        errors.push(`Stage "${stage.id}" has no agents.`);
      }
    }

    for (const stage of stages) {
      for (const dependency of stage.dependsOn) {
        if (!stageIds.has(dependency)) {
          errors.push(
            `Stage "${stage.id}" depends on unknown stage "${dependency}".`
          );
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(errors.join('\n'));
    }
  }

  /**
   * Runs the production pipeline sequentially.
   */
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

    const resolvedStages = normalizedStages.map(stage => ({
      ...stage,
      resolvedAgents: stage.agents.map(agentId => ({
        id: agentId,
        agent: this.resolveAgent(agentId)
      }))
    }));

    const job = this.jobManager.createJob({
      idea: idea.trim(),
      input,
      type: 'story-production'
    });

    const stageRecords = resolvedStages.map(stage => ({
      id: stage.id,
      name: stage.name,
      status: stage.resolvedAgents.every(item => item.agent)
        ? 'pending'
        : 'unavailable',
      agents: stage.agents,
      output: null,
      validation: null,
      agentValidations: [],
      error: null,
      startedAt: null,
      completedAt: null
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

    for (const stage of resolvedStages) {
      const currentJob = this.jobManager.getJob(job.jobId);

      const record = currentJob.stages.find(
        item => item.id === stage.id
      );

      if (!record) {
        stopped = true;
        break;
      }

      if (stopped) {
        this.jobManager.updateStage(job.jobId, stage.id, {
          status: 'skipped',
          error: 'Skipped because an earlier stage did not complete.'
        });
        continue;
      }

      // Verify dependencies.
      const dependenciesCompleted = stage.dependsOn.every(
        dependencyId => {
          const dependency = currentJob.stages.find(
            item => item.id === dependencyId
          );

          return dependency && dependency.status === 'completed';
        }
      );

      if (!dependenciesCompleted) {
        this.jobManager.updateStage(job.jobId, stage.id, {
          status: 'skipped',
          error: 'Required dependency stage did not complete.'
        });

        stopped = true;
        continue;
      }

      // All agents must be available before this stage can run.
      const unavailableAgent = stage.resolvedAgents.find(
        item => !item.agent
      );

      if (unavailableAgent) {
        this.jobManager.updateStage(job.jobId, stage.id, {
          status: 'unavailable',
          error: `Required agent "${unavailableAgent.id}" is unavailable.`
        });

        stopped = true;
        continue;
      }

      this.jobManager.updateStage(job.jobId, stage.id, {
        status: 'running',
        startedAt: Date.now()
      });

      const stageAgentOutputs = {};
      const agentValidations = [];

      try {
        // Execute agents sequentially inside each stage.
        for (const resolved of stage.resolvedAgents) {
          const agent = resolved.agent;

          const agentContext = {
            ...context,
            currentStage: {
              id: stage.id,
              name: stage.name,
              outputKey: stage.outputKey
            },
            stageOutputs: {
              ...context.stageOutputs
            },
            agentOutputs: {
              ...context.agentOutputs
            },
            currentStageOutputs: {
              ...stageAgentOutputs
            }
          };

          const output = await agent.run(agentContext);

          // Validate every individual agent output.
          const agentValidation = this.validator.validateAgentOutput(
            agent.id,
            output
          );

          agentValidations.push({
            agentId: agent.id,
            ...agentValidation
          });

          if (!agentValidation.valid) {
            const validationError = new Error(
              `Output validation failed for agent "${agent.id}": ` +
              agentValidation.errors.join('; ')
            );

            validationError.validation = agentValidation;
            throw validationError;
          }

          stageAgentOutputs[agent.id] = output;

          context.agentOutputs[agent.id] = output;
        }

        // Build the combined stage output.
        const stageOutput =
          stage.resolvedAgents.length === 1
            ? stageAgentOutputs[stage.resolvedAgents[0].id]
            : { ...stageAgentOutputs };

        // Validate the combined stage output.
        const stageValidation = this.validator.validateStageOutput(
          stage.id,
          stageOutput
        );

        if (!stageValidation.valid) {
          const validationError = new Error(
            `Stage validation failed for "${stage.name}": ` +
            stageValidation.errors.join('; ')
          );

          validationError.validation = stageValidation;
          throw validationError;
        }

        // Only store outputs after successful validation.
        this.jobManager.setOutput(
          job.jobId,
          stage.id,
          stageOutput
        );

        context.stageOutputs[stage.outputKey] = stageOutput;
        context[stage.id] = stageOutput;
        context.previousOutput = stageOutput;

        this.jobManager.updateStage(job.jobId, stage.id, {
          status: 'completed',
          output: stageOutput,
          validation: stageValidation,
          agentValidations,
          completedAt: Date.now()
        });
      } catch (error) {
        this.jobManager.updateStage(job.jobId, stage.id, {
          status: 'failed',
          error: error.message || 'Production stage failed.',
          validation: error.validation || null,
          agentValidations,
          completedAt: Date.now()
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
    } else if (
      finalJob.stages.some(stage => stage.status === 'skipped')
    ) {
      finalStatus = completed > 0 ? 'partial' : 'not_ready';
    } else {
      finalStatus = 'completed';
    }

    this.jobManager.completeJob(job.jobId, finalStatus);

    return this.jobManager.getJob(job.jobId);
  }
}

module.exports = PipelineEngine;
          

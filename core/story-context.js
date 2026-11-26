
'use strict';

const crypto = require('crypto');

class StoryContext {
  constructor(options = {}) {
    const {
      storyId,
      title = 'Untitled Story',
      prompt = '',
      metadata = {},
      requirements = {},
      restrictions = []
    } = options;

    this.storyId = storyId || crypto.randomUUID();
    this.version = 1;
    this.createdAt = new Date().toISOString();
    this.updatedAt = this.createdAt;

    this.metadata = {
      title,
      genre: null,
      tone: null,
      targetAudience: null,
      language: 'English',
      format: 'video',
      duration: null,
      ...metadata
    };

    this.originalPrompt = String(prompt);

    this.requirements = {
      ...requirements
    };

    this.restrictions = Array.isArray(restrictions)
      ? [...restrictions]
      : [];

    this.story = {
      direction: null,
      logline: null,
      summary: null,
      narrative: null,
      structure: null,
      ending: null
    };

    this.scenes = [];
    this.characters = [];

    this.world = {
      description: null,
      locations: [],
      rules: [],
      atmosphere: null
    };

    this.continuity = {
      rules: [],
      facts: [],
      unresolvedIssues: []
    };

    this.productionRequirements = {
      animation: [],
      camera: [],
      audio: [],
      visualStyle: [],
      technical: []
    };

    this.agentRecords = [];

    this.validation = {
      status: 'pending',
      errors: [],
      warnings: [],
      lastCheckedAt: null
    };

    this.status = 'created';
  }

  updateMetadata(updates = {}) {
    if (!updates || typeof updates !== 'object') {
      throw new TypeError('Metadata updates must be an object.');
    }

    this.metadata = {
      ...this.metadata,
      ...updates
    };

    this.touch();
    return this;
  }

  updateRequirements(updates = {}) {
    if (!updates || typeof updates !== 'object') {
      throw new TypeError('Requirements must be an object.');
    }

    this.requirements = {
      ...this.requirements,
      ...updates
    };

    this.touch();
    return this;
  }

  addRestriction(restriction) {
    if (
      typeof restriction !== 'string' ||
      !restriction.trim()
    ) {
      throw new TypeError(
        'Restriction must be a non-empty string.'
      );
    }

    if (!this.restrictions.includes(restriction)) {
      this.restrictions.push(restriction);
      this.touch();
    }

    return this;
  }

  updateStory(updates = {}) {
    this.story = {
      ...this.story,
      ...updates
    };

    this.touch();
    return this;
  }

  setScenes(scenes) {
    if (!Array.isArray(scenes)) {
      throw new TypeError('Scenes must be an array.');
    }

    this.scenes = this.clone(scenes);
    this.touch();
    return this;
  }

  setCharacters(characters) {
    if (!Array.isArray(characters)) {
      throw new TypeError('Characters must be an array.');
    }

    this.characters = this.clone(characters);
    this.touch();
    return this;
  }

  updateWorld(updates = {}) {
    this.world = {
      ...this.world,
      ...updates
    };

    this.touch();
    return this;
  }

  updateContinuity(updates = {}) {
    this.continuity = {
      ...this.continuity,
      ...updates
    };

    this.touch();
    return this;
  }

  updateProductionRequirements(updates = {}) {
    this.productionRequirements = {
      ...this.productionRequirements,
      ...updates
    };

    this.touch();
    return this;
  }

  recordAgentExecution(record = {}) {
    const entry = {
      agentId: record.agentId || 'unknown',
      stage: record.stage || null,
      status: record.status || 'unknown',
      startedAt: record.startedAt || null,
      completedAt:
        record.completedAt || new Date().toISOString(),
      durationMs: record.durationMs ?? null,
      error: record.error || null,
      outputSummary: record.outputSummary || null
    };

    this.agentRecords.push(entry);
    this.touch();

    return this.clone(entry);
  }

  setValidation(result = {}) {
    this.validation = {
      status: result.status || 'pending',
      errors: Array.isArray(result.errors)
        ? [...result.errors]
        : [],
      warnings: Array.isArray(result.warnings)
        ? [...result.warnings]
        : [],
      lastCheckedAt: new Date().toISOString()
    };

    this.touch();
    return this;
  }

  setStatus(status) {
    if (
      typeof status !== 'string' ||
      !status.trim()
    ) {
      throw new TypeError(
        'Status must be a non-empty string.'
      );
    }

    this.status = status;
    this.touch();
    return this;
  }

  getSection(section) {
    if (!(section in this)) {
      throw new Error(
        `Unknown story context section: ${section}`
      );
    }

    return this.clone(this[section]);
  }

  // FIX:
  // Build a plain data object instead of cloning the class instance.
  // This prevents JSON.stringify from calling toJSON recursively.
  snapshot() {
    const data = {};

    for (const key of Object.keys(this)) {
      data[key] = this.clone(this[key]);
    }

    return data;
  }

  // JSON serialization now safely returns plain data.
  toJSON() {
    return this.snapshot();
  }

  touch() {
    this.version += 1;
    this.updatedAt = new Date().toISOString();
  }

  clone(value) {
    if (value === undefined) {
      return undefined;
    }

    return JSON.parse(JSON.stringify(value));
  }

  static fromJSON(data) {
    if (!data || typeof data !== 'object') {
      throw new TypeError(
        'Story context data must be an object.'
      );
    }

    const context = new StoryContext({
      storyId: data.storyId,
      title: data.metadata?.title,
      prompt: data.originalPrompt,
      metadata: data.metadata,
      requirements: data.requirements,
      restrictions: data.restrictions
    });

    Object.assign(context, context.clone(data));

    return context;
  }
}

module.exports = StoryContext;
    

"use strict";

class IntelligenceMemory {
  constructor(options = {}) {
    this.maximumEntries = options.maximumEntries ?? 5000;
    this.minimumScore = options.minimumScore ?? 0.05;
    this.entries = new Map();
  }

  // --------------------------------------------------
  // STORE KNOWLEDGE
  // --------------------------------------------------

  store(knowledge = {}) {
    if (!knowledge || typeof knowledge !== "object" ||
        Array.isArray(knowledge)) {
      return {
        success: false,
        error: "Knowledge must be an object."
      };
    }

    if (typeof knowledge.content !== "string" ||
        !knowledge.content.trim()) {
      return {
        success: false,
        error: "Knowledge content is required."
      };
    }

    const content = knowledge.content.trim();
    const category = this.normalizeText(
      knowledge.category || "general"
    );

    // Detect duplicate knowledge.
    const existing = Array.from(this.entries.values()).find(
      entry =>
        this.normalizeText(entry.content) ===
          this.normalizeText(content) &&
        entry.category === category
    );

    if (existing) {
      return {
        success: true,
        duplicate: true,
        memoryId: existing.id,
        totalEntries: this.entries.size
      };
    }

    if (this.entries.size >= this.maximumEntries) {
      return {
        success: false,
        error: "Memory capacity reached."
      };
    }

    const memory = {
      id: knowledge.id || this.createId(),
      content,
      category,
      tags: this.normalizeTags(knowledge.tags),
      metadata:
        knowledge.metadata &&
        typeof knowledge.metadata === "object"
          ? { ...knowledge.metadata }
          : {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      accessCount: 0
    };

    if (this.entries.has(memory.id)) {
      return {
        success: false,
        error: "Memory ID already exists."
      };
    }

    this.entries.set(memory.id, memory);

    return {
      success: true,
      duplicate: false,
      memoryId: memory.id,
      totalEntries: this.entries.size
    };
  }

  // --------------------------------------------------
  // RETRIEVE KNOWLEDGE
  // --------------------------------------------------

  search(query, options = {}) {
    if (typeof query !== "string" || !query.trim()) {
      return {
        success: false,
        error: "A valid search query is required.",
        results: []
      };
    }

    const limit = Math.max(
      1,
      Math.floor(options.limit ?? 10)
    );

    const category = options.category
      ? this.normalizeText(options.category)
      : null;

    const queryTokens = this.tokenize(query);

    const results = [];

    for (const memory of this.entries.values()) {
      if (category && memory.category !== category) {
        continue;
      }

      const score = this.calculateScore(
        query,
        queryTokens,
        memory
      );

      if (score < this.minimumScore) {
        continue;
      }

      results.push({
        memory: { ...memory, tags: [...memory.tags] },
        score
      });
    }

    results.sort((a, b) => b.score - a.score);

    const selected = results.slice(0, limit);

    // Update access count for retrieved memories.
    for (const result of selected) {
      const stored = this.entries.get(result.memory.id);

      if (stored) {
        stored.accessCount += 1;
      }

      result.memory.accessCount = stored
        ? stored.accessCount
        : result.memory.accessCount;
    }

    return {
      success: true,
      query,
      totalMatches: results.length,
      results: selected
    };
  }

  calculateScore(query, queryTokens, memory) {
    const content = this.normalizeText(memory.content);
    const category = memory.category;
    const tags = memory.tags.map(tag =>
      this.normalizeText(tag)
    );

    let score = 0;

    // Exact phrase match.
    if (content.includes(this.normalizeText(query))) {
      score += 0.5;
    }

    // Keyword matching.
    const contentTokens = this.tokenize(memory.content);
    const tagTokens = this.tokenize(tags.join(" "));
    const categoryTokens = this.tokenize(category);

    let matchedContent = 0;
    let matchedTags = 0;
    let matchedCategory = 0;

    for (const token of queryTokens) {
      if (contentTokens.includes(token)) {
        matchedContent++;
      }

      if (tagTokens.includes(token)) {
        matchedTags++;
      }

      if (categoryTokens.includes(token)) {
        matchedCategory++;
      }
    }

    if (queryTokens.length > 0) {
      score +=
        (matchedContent / queryTokens.length) * 0.35;

      score +=
        (matchedTags / queryTokens.length) * 0.25;

      score +=
        (matchedCategory / queryTokens.length) * 0.10;
    }

    // Small relevance boost for previously useful memories.
    score += Math.min(memory.accessCount * 0.01, 0.05);

    return Math.min(score, 1);
  }

  // --------------------------------------------------
  // DIRECT ACCESS
  // --------------------------------------------------

  get(memoryId) {
    const memory = this.entries.get(memoryId);

    if (!memory) {
      return null;
    }

    memory.accessCount += 1;

    return {
      ...memory,
      tags: [...memory.tags]
    };
  }

  getAll(options = {}) {
    const category = options.category
      ? this.normalizeText(options.category)
      : null;

    return Array.from(this.entries.values())
      .filter(memory =>
        !category || memory.category === category
      )
      .map(memory => ({
        ...memory,
        tags: [...memory.tags]
      }));
  }

  // --------------------------------------------------
  // UPDATE KNOWLEDGE
  // --------------------------------------------------

  update(memoryId, changes = {}) {
    const memory = this.entries.get(memoryId);

    if (!memory) {
      return {
        success: false,
        error: "Memory not found."
      };
    }

    if (changes.content !== undefined) {
      if (
        typeof changes.content !== "string" ||
        !changes.content.trim()
      ) {
        return {
          success: false,
          error: "Updated content must be a non-empty string."
        };
      }

      memory.content = changes.content.trim();
    }

    if (changes.category !== undefined) {
      memory.category = this.normalizeText(
        changes.category
      );
    }

    if (changes.tags !== undefined) {
      memory.tags = this.normalizeTags(changes.tags);
    }

    if (changes.metadata !== undefined) {
      if (
        !changes.metadata ||
        typeof changes.metadata !== "object" ||
        Array.isArray(changes.metadata)
      ) {
        return {
          success: false,
          error: "Metadata must be an object."
        };
      }

      memory.metadata = { ...changes.metadata };
    }

    memory.updatedAt = new Date().toISOString();

    return {
      success: true,
      memoryId,
      memory: { ...memory, tags: [...memory.tags] }
    };
  }

  // --------------------------------------------------
  // DELETE KNOWLEDGE
  // --------------------------------------------------

  remove(memoryId) {
    if (!this.entries.has(memoryId)) {
      return {
        success: false,
      error: "Memory not found."
      };
    }

    this.entries.delete(memoryId);

    return {
      success: true,
      memoryId,
      totalEntries: this.entries.size
    };
  }

  clear() {
    const removed = this.entries.size;
    this.entries.clear();

    return {
      success: true,
      removed,
      totalEntries: 0
    };
  }

  // --------------------------------------------------
  // EXPORT
  // --------------------------------------------------

  export() {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      entries: this.getAll()
    };
  }

  // --------------------------------------------------
  // IMPORT / RESTORE
  // --------------------------------------------------

  import(data, options = {}) {
    if (
      !data ||
      typeof data !== "object" ||
      !Array.isArray(data.entries)
    ) {
      return {
        success: false,
        error: "Invalid memory import format."
      };
    }

    const replace = options.replace === true;

    if (replace) {
      this.clear();
    }

    let imported = 0;
    let skipped = 0;
    let errors = 0;

    for (const entry of data.entries) {
      const result = this.store({
        id: entry.id,
        content: entry.content,
        category: entry.category,
        tags: entry.tags,
        metadata: entry.metadata
      });

      if (result.success && !result.duplicate) {
        const restored = this.entries.get(result.memoryId);

        if (restored) {
          restored.createdAt =
            entry.createdAt || restored.createdAt;

          restored.updatedAt =
            entry.updatedAt || restored.updatedAt;

          restored.accessCount =
            Number.isInteger(entry.accessCount) &&
            entry.accessCount >= 0
              ? entry.accessCount
              : 0;
        }

        imported++;
      } else if (result.success) {
        skipped++;
      } else {
        errors++;
      }
    }

    return {
      success: true,
      imported,
      skipped,
      errors,
      totalEntries: this.entries.size
    };
  }

  // --------------------------------------------------
  // UTILITIES
  // --------------------------------------------------

  normalizeTags(tags) {
    if (!Array.isArray(tags)) {
      return [];
    }

    return [
      ...new Set(
        tags
          .filter(tag => typeof tag === "string")
          .map(tag => this.normalizeText(tag))
          .filter(Boolean)
      )
    ];
  }

  normalizeText(value) {
    return String(value)
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ");
  }

  tokenize(value) {
    return this.normalizeText(value)
      .split(/[^a-z0-9]+/)
      .filter(token => token.length > 1);
  }

  createId() {
    return (
      "memory_" +
      Date.now().toString(36) +
      "_" +
      Math.random().toString(36).slice(2, 10)
    );
  }
}

module.exports = IntelligenceMemory;
                                    

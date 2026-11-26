
"use strict";

/**
 * StoryForge Deep Understanding AI
 *
 * Native prompt-intelligence engine.
 * Does not require an LLM API or external dependencies.
 *
 * Capabilities:
 * - Prompt decomposition
 * - Intent analysis
 * - Entity extraction
 * - Story element detection
 * - Requirement extraction
 * - Constraint detection
 * - Context analysis
 * - Ambiguity detection
 * - Creative opportunity identification
 * - Structured analysis reports
 */

class DeepUnderstandingAI {
  constructor(options = {}) {
    this.id = "deep-understanding-ai";
    this.name = "StoryForge Deep Understanding AI";
    this.version = "1.0.0";

    this.options = {
      maxPromptLength: options.maxPromptLength || 50000,
      minPromptLength: options.minPromptLength || 3,
      includeCreativeSuggestions:
        options.includeCreativeSuggestions !== false
    };

    this.intentPatterns = {
      create: [
        "create",
        "make",
        "generate",
        "write",
        "build",
        "develop",
        "produce",
        "design"
      ],
      modify: [
        "change",
        "modify",
        "edit",
        "update",
        "improve",
        "rewrite",
        "revise"
      ],
      explain: [
        "explain",
        "describe",
        "tell me",
        "what is",
        "how does",
        "understand"
      ],
      analyze: [
        "analyze",
        "analyse",
        "evaluate",
        "compare",
        "review",
        "examine"
      ],
      continue: [
        "continue",
        "next",
        "carry on",
        "keep going",
        "continue from"
      ]
    };

    this.entityPatterns = {
      characters: [
        /\b(?:character|characters|hero|heroine|protagonist|villain|antagonist|boy|girl|man|woman)\b/gi
      ],

      locations: [
        /\b(?:forest|village|city|kingdom|castle|school|mountain|island|planet|world|desert|ocean|cave)\b/gi
      ],

      storyElements: [
        /\b(?:story|plot|scene|chapter|episode|ending|beginning|twist|conflict|journey|adventure|quest|mission)\b/gi
      ],

      visualElements: [
        /\b(?:camera|visual|animation|animated|cinematic|lighting|color|shot|angle|background|render|3d|environment)\b/gi
      ],

      audioElements: [
        /\b(?:music|sound|audio|voice|dialogue|soundtrack|effects|sfx|narration)\b/gi
      ]
    };

    this.constraintPatterns = {
      negative: [
        /\b(?:do not|don't|dont|never|without|avoid|no|not include|exclude|remove)\b/gi
      ],

      mandatory: [
        /\b(?:must|should|required|make sure|ensure|include|need to|has to|have to)\b/gi
      ],

      quantity: [
        /\b\d+\s*(?:characters|scenes|episodes|chapters|minutes|seconds|parts)\b/gi
      ]
    };
  }

  analyze(prompt, options = {}) {
    const startedAt = Date.now();

    try {
      this.validatePrompt(prompt);

      const normalizedPrompt = this.normalizePrompt(prompt);

      const sentences = this.splitSentences(normalizedPrompt);

      const intent = this.analyzeIntent(normalizedPrompt);

      const entities = this.extractEntities(normalizedPrompt);

      const requirements = this.extractRequirements(
        normalizedPrompt,
        sentences
      );

      const constraints = this.extractConstraints(
        normalizedPrompt,
        sentences
      );

      const context = this.analyzeContext(
        normalizedPrompt,
        sentences,
        entities
      );

      const ambiguities = this.detectAmbiguities(
        normalizedPrompt,
        entities,
        requirements
      );

      const creativeOpportunities =
        this.options.includeCreativeSuggestions &&
        options.includeCreativeSuggestions !== false
          ? this.findCreativeOpportunities(
              normalizedPrompt,
              entities,
              context,
              ambiguities
            )
          : [];

      const complexity = this.estimateComplexity({
        prompt: normalizedPrompt,
        sentences,
        entities,
        requirements,
        constraints
      });

      const report = {
        success: true,

        agent: {
          id: this.id,
          name: this.name,
          version: this.version
        },

        input: {
          originalPrompt: prompt,
          normalizedPrompt
        },

        understanding: {
          intent,
          context,
          entities,
          requirements,
          constraints,
          ambiguities,
          creativeOpportunities,
          complexity
        },

        metadata: {
          sentenceCount: sentences.length,
          promptLength: prompt.length,
          analysisDurationMs: Date.now() - startedAt,
          timestamp: new Date().toISOString()
        }
      };

      return report;
    } catch (error) {
      return {
        success: false,

        agent: {
          id: this.id,
          name: this.name,
          version: this.version
        },

        error: {
          message: error.message,
          code: error.code || "DEEP_UNDERSTANDING_ERROR"
        },

        metadata: {
          analysisDurationMs: Date.now() - startedAt,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  validatePrompt(prompt) {
    if (typeof prompt !== "string") {
      const error = new TypeError("Prompt must be a string.");
      error.code = "INVALID_PROMPT_TYPE";
      throw error;
    }

    if (prompt.trim().length < this.options.minPromptLength) {
      const error = new Error("Prompt is too short to analyze.");
      error.code = "PROMPT_TOO_SHORT";
      throw error;
    }

    if (prompt.length > this.options.maxPromptLength) {
      const error = new Error("Prompt exceeds the maximum allowed length.");
      error.code = "PROMPT_TOO_LONG";
      throw error;
    }
  }

  normalizePrompt(prompt) {
    return prompt
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  splitSentences(text) {
    return text
      .split(/(?<=[.!?])\s+|\n+/)
      .map(sentence => sentence.trim())
      .filter(Boolean);
  }

  analyzeIntent(prompt) {
    const lower = prompt.toLowerCase();

    const scores = {};

    for (const [intent, keywords] of Object.entries(
      this.intentPatterns
    )) {
      scores[intent] = keywords.reduce((score, keyword) => {
        const escaped = keyword.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&"
        );

        const regex = new RegExp(`\\b${escaped}\\b`, "gi");

        const matches = lower.match(regex);

        return score + (matches ? matches.length : 0);
      }, 0);
    }

    const ranked = Object.entries(scores)
      .sort((a, b) => b[1] - a[1]);

    const primary = ranked[0];

    return {
      primary: primary && primary[1] > 0
        ? primary[0]
        : "unknown",

      confidence: primary && primary[1] > 0
        ? Math.min(primary[1] / 5, 1)
        : 0,

      detectedIntents: ranked
        .filter(([, score]) => score > 0)
        .map(([name, score]) => ({
          name,
          score
        })),

      scores
    };
  }

  extractEntities(prompt) {
    const result = {};

    for (const [category, patterns] of Object.entries(
      this.entityPatterns
    )) {
      const values = [];

      for (const pattern of patterns) {
        const matches = prompt.match(pattern) || [];
        values.push(...matches);
      }

      result[category] = [...new Set(
        values.map(value => value.toLowerCase())
      )];
    }

    return result;
  }

  extractRequirements(prompt, sentences) {
    const requirements = [];

    const mandatoryPatterns = [
      /\bmust\b/i,
      /\bmake sure\b/i,
      /\bensure\b/i,
      /\binclude\b/i,
      /\bneeds to\b/i,
      /\bshould\b/i,
      /\brequired\b/i
    ];

    for (const sentence of sentences) {
      if (
        mandatoryPatterns.some(pattern => pattern.test(sentence))
      ) {
        requirements.push({
          text: sentence,
          source: "explicit_prompt",
          priority: /\bmust|required|make sure|ensure\b/i.test(sentence)
            ? "high"
            : "normal"
        });
      }
    }

    return this.uniqueObjects(requirements, "text");
  }

  extractConstraints(prompt, sentences) {
    const constraints = {
      exclusions: [],
      mandatory: [],
      quantities: [],
      instructions: []
    };

    for (const sentence of sentences) {
      if (
        this.constraintPatterns.negative.some(pattern =>
          pattern.test(sentence)
        )
      ) {
        constraints.exclusions.push(sentence);
      }

      if (
        this.constraintPatterns.mandatory.some(pattern =>
          pattern.test(sentence)
        )
      ) {
        constraints.mandatory.push(sentence);
      }

      const quantities = sentence.match(
        this.constraintPatterns.quantity[0]
      );

      if (quantities) {
        constraints.quantities.push(...quantities);
      }
    }

    constraints.exclusions = [...new Set(
      constraints.exclusions
    )];

    constraints.mandatory = [...new Set(
      constraints.mandatory
    )];

    constraints.quantities = [...new Set(
      constraints.quantities
    )];

    constraints.instructions = sentences.filter(sentence =>
      /\b(?:keep|preserve|maintain|exactly|only|same|consistent)\b/i
        .test(sentence)
    );

    return constraints;
  }

  analyzeContext(prompt, sentences, entities) {
    return {
      sentenceConnections: sentences.map((sentence, index) => ({
        index,
        text: sentence,
        previousSentence: index > 0
          ? sentences[index - 1]
          : null,
        nextSentence: index < sentences.length - 1
          ? sentences[index + 1]
          : null
      })),

      recurringThemes: this.findRecurringThemes(prompt),

      detectedDomains: this.detectDomains(prompt),

      referencedStoryElements: entities.storyElements,

      contextSize: {
        sentences: sentences.length,
        words: prompt.split(/\s+/).filter(Boolean).length,
        characters: prompt.length
      }
    };
  }

  findRecurringThemes(prompt) {
    const themeKeywords = {
      adventure: ["adventure", "journey", "quest", "mission"],
      fantasy: ["magic", "magical", "dragon", "fantasy", "spell"],
      mystery: ["mystery", "secret", "hidden", "clue", "unknown"],
      danger: ["danger", "threat", "risk", "attack", "escape"],
      friendship: ["friend", "friendship", "team", "together", "ally"],
      emotion: ["sad", "happy", "fear", "hope", "love", "emotion"],
      science: ["science", "technology", "robot", "experiment", "future"],
      survival: ["survive", "survival", "lost", "wilderness", "stranded"]
    };

    const lower = prompt.toLowerCase();

    return Object.entries(themeKeywords)
      .filter(([, keywords]) =>
        keywords.some(keyword => lower.includes(keyword))
      )
      .map(([theme]) => theme);
  }

  detectDomains(prompt) {
    const domains = {
      storytelling: [
        "story", "character", "scene", "plot", "chapter"
      ],
      animation: [
        "animation", "animate", "animated", "movement"
      ],
      video: [
        "video", "film", "cinematic", "camera", "shot"
      ],
      gaming: [
        "game", "roblox", "player", "level", "obstacle"
      ],
      audio: [
        "audio", "voice", "sound", "music", "dialogue"
      ],
      worldbuilding: [
        "world", "environment", "kingdom", "planet", "village"
      ]
    };

    const lower = prompt.toLowerCase();

    return Object.entries(domains)
      .filter(([, keywords]) =>
        keywords.some(keyword => lower.includes(keyword))
      )
      .map(([domain]) => domain);
  }

  detectAmbiguities(prompt, entities, requirements) {
    const ambiguities = [];

    if (prompt.length < 25) {
      ambiguities.push({
        type: "limited_detail",
        severity: "low",
        message: "The prompt contains very little detail."
      });
    }

    if (
      entities.characters.length > 0 &&
      !/\b(?:name|named|called)\b/i.test(prompt)
    ) {
      ambiguities.push({
        type: "character_identity",
        severity: "low",
        message: "Character identities or names may need clarification."
      });
    }

    if (
      /\b(?:later|soon|eventually|after that|sometime)\b/i.test(prompt)
    ) {
      ambiguities.push({
        type: "timeline",
        severity: "low",
        message: "Some timeline details are unspecified."
      });
    }

    if (
      /\b(?:it|they|them|this|that)\b/i.test(prompt) &&
      prompt.split(/\s+/).length < 15
    ) {
      ambiguities.push({
        type: "reference",
        severity: "low",
        message: "Some references may depend on missing context."
      });
    }

    return ambiguities;
  }

  findCreativeOpportunities(
    prompt,
    entities,
    context,
    ambiguities
  ) {
    const opportunities = [];

    const themes = context.recurringThemes;

    if (themes.includes("mystery")) {
      opportunities.push({
        type: "story_development",
        suggestion:
          "Consider revealing information gradually to build suspense.",
        reason: "Mystery-related elements were detected."
      });
    }

    if (themes.includes("adventure")) {
      opportunities.push({
        type: "world_development",
        suggestion:
          "Consider connecting the journey to meaningful discoveries.",
        reason: "Adventure-related elements were detected."
      });
    }

    if (themes.includes("friendship")) {
      opportunities.push({
        type: "character_development",
        suggestion:
          "Consider giving characters complementary strengths.",
        reason: "Team or friendship themes were detected."
      });
    }

    if (themes.includes("danger")) {
      opportunities.push({
        type: "tension",
        suggestion:
          "Consider gradually increasing the stakes as the story progresses.",
        reason: "Danger-related elements were detected."
      });
    }

    if (themes.includes("science")) {
      opportunities.push({
        type: "world_development",
        suggestion:
          "Consider connecting the scientific elements to the story's central conflict.",
        reason: "Science or technology themes were detected."
      });
    }

    if (ambiguities.length > 0) {
      opportunities.push({
        type: "clarification",
        suggestion:
          "Review unspecified details before finalizing the story blueprint.",
        reason: "Potentially ambiguous details were detected."
      });
    }

    return opportunities;
  }

  estimateComplexity(data) {
    let score = 0;

    score += Math.min(data.sentences.length * 2, 20);
    score += Math.min(data.entities.characters.length * 4, 20);
    score += Math.min(data.entities.locations.length * 3, 15);
    score += Math.min(data.requirements.length * 4, 20);
    score += Math.min(data.constraints.exclusions.length * 4, 15);
    score += Math.min(data.prompt.length / 100, 10);

    score = Math.min(Math.round(score), 100);

    return {
      score,
      level:
        score < 25
          ? "simple"
          : score < 60
            ? "moderate"
            : "complex"
    };
  }

  uniqueObjects(items, key) {
    const seen = new Set();

    return items.filter(item => {
      const value = item[key];

      if (seen.has(value)) {
        return false;
      }

      seen.add(value);
      return true;
    });
  }
}

module.exports = DeepUnderstandingAI;
      

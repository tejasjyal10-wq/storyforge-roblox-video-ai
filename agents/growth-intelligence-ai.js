
"use strict";

/**
 * StoryForge Growth Intelligence AI
 *
 * Responsibilities:
 * - Record experience and feedback
 * - Analyze successful, failed, and partial outcomes
 * - Detect recurring patterns
 * - Identify improvement opportunities
 * - Produce evidence-based recommendations
 * - Track confidence and supporting evidence
 *
 * This is a deterministic intelligence component.
 * It does not train neural-network weights or claim
 * to be a language model.
 */

class GrowthIntelligenceAI {
  constructor(options = {}) {
    this.name = "Growth Intelligence AI";
    this.version = "1.0.0";

    this.options = {
      minimumPatternOccurrences:
        options.minimumPatternOccurrences ?? 2,

      maximumExperiences:
        options.maximumExperiences ?? 1000,

      minimumRating:
        options.minimumRating ?? 1,

      maximumRating:
        options.maximumRating ?? 5
    };

    this.experiences = [];
    this.recommendations = [];
    this.lastAnalysis = null;
  }

  // --------------------------------------------------
  // 1. RECORD EXPERIENCE
  // --------------------------------------------------

  recordExperience(experience = {}) {
    try {
      const normalized = this.normalizeExperience(experience);

      this.experiences.push(normalized);

      if (
        this.experiences.length >
        this.options.maximumExperiences
      ) {
        this.experiences.shift();
      }

      return {
        success: true,
        experienceId: normalized.id,
        totalExperiences: this.experiences.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  normalizeExperience(experience) {
    if (!experience || typeof experience !== "object") {
      throw new Error("Experience must be an object.");
    }

    const outcome = this.normalizeOutcome(
      experience.outcome
    );

    const rating =
      experience.rating == null
        ? null
        : Number(experience.rating);

    if (
      rating !== null &&
      (
        !Number.isFinite(rating) ||
        rating < this.options.minimumRating ||
        rating > this.options.maximumRating
      )
    ) {
      throw new Error("Experience rating is invalid.");
    }

    const tags = Array.isArray(experience.tags)
      ? experience.tags
          .filter(tag => typeof tag === "string")
          .map(tag => this.normalizeText(tag))
          .filter(Boolean)
      : [];

    return {
      id:
        typeof experience.id === "string" &&
        experience.id.trim()
          ? experience.id.trim()
          : this.createId(),

      task:
        typeof experience.task === "string"
          ? experience.task.trim()
          : "",

      outcome,

      feedback:
        typeof experience.feedback === "string"
          ? experience.feedback.trim()
          : "",

      rating,

      tags: [...new Set(tags)],

      agent:
        typeof experience.agent === "string"
          ? experience.agent.trim()
          : "unknown",

      context:
        experience.context &&
        typeof experience.context === "object"
          ? { ...experience.context }
          : {},

      timestamp:
        experience.timestamp &&
        !Number.isNaN(Date.parse(experience.timestamp))
          ? new Date(experience.timestamp).toISOString()
          : new Date().toISOString()
    };
  }

  normalizeOutcome(outcome) {
    const allowed = [
      "success",
      "failure",
      "partial",
      "unknown"
    ];

    return allowed.includes(outcome)
      ? outcome
      : "unknown";
  }

  // --------------------------------------------------
  // 2. ANALYZE EXPERIENCES
  // --------------------------------------------------

  analyze(experiences = this.experiences) {
    try {
      if (!Array.isArray(experiences)) {
        throw new Error(
          "Experiences must be provided as an array."
        );
      }

      const valid = experiences.filter(
        item =>
          item &&
          typeof item === "object" &&
          ["success", "failure", "partial", "unknown"]
            .includes(item.outcome)
      );

      const total = valid.length;

      const counts = {
        success: 0,
        failure: 0,
        partial: 0,
        unknown: 0
      };

      for (const item of valid) {
        counts[item.outcome]++;
      }

      const evaluated = counts.success +
        counts.failure +
        counts.partial;

      const successRate = evaluated > 0
        ? Number(
            (
              counts.success / evaluated
            ).toFixed(3)
          )
        : 0;

      const patterns = this.detectPatterns(valid);

      const feedbackInsights =
        this.analyzeFeedback(valid);

      const recommendations =
        this.generateRecommendations({
          counts,
          successRate,
          patterns,
          feedbackInsights,
          total
        });

      const report = {
        system: this.name,
        version: this.version,
        analyzedAt: new Date().toISOString(),

        summary: {
          totalExperiences: total,
          evaluatedExperiences: evaluated,
          successRate,
          outcomes: counts
        },

        patterns,
        feedbackInsights,
        recommendations,

        confidence: this.calculateConfidence(total),

        limitations: [
          "Patterns are based only on recorded experiences.",
          "Correlation does not prove causation.",
          "Recommendations require validation.",
          "This component does not modify model weights."
        ]
      };

      this.recommendations = recommendations;
      this.lastAnalysis = report;

      return {
        success: true,
        report
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // --------------------------------------------------
  // 3. PATTERN DETECTION
  // --------------------------------------------------

  detectPatterns(experiences) {
    const tagMap = new Map();

    for (const experience of experiences) {
      for (const tag of experience.tags || []) {
        if (!tagMap.has(tag)) {
          tagMap.set(tag, {
            tag,
            total: 0,
            success: 0,
            failure: 0,
            partial: 0,
            unknown: 0
          });
        }

        const entry = tagMap.get(tag);

        entry.total++;
        entry[experience.outcome]++;
      }
    }

    return [...tagMap.values()]
      .filter(
        pattern =>
          pattern.total >=
          this.options.minimumPatternOccurrences
      )
      .map(pattern => {
        const evaluated =
          pattern.success +
          pattern.failure +
          pattern.partial;

        const rate = evaluated > 0
          ? Number(
              (
                pattern.success / evaluated
              ).toFixed(3)
            )
          : 0;

        let trend = "mixed";

        if (
          evaluated > 0 &&
          pattern.success === evaluated
        ) {
          trend = "positive";
        } else if (
          evaluated > 0 &&
          pattern.failure === evaluated
        ) {
          trend = "negative";
        } else if (
          pattern.failure > pattern.success
        ) {
          trend = "needs_attention";
        } else if (
          pattern.success > pattern.failure
        ) {
          trend = "mostly_positive";
        }

        return {
          tag: pattern.tag,
          occurrences: pattern.total,
          successRate: rate,
          outcomes: {
            success: pattern.success,
            failure: pattern.failure,
            partial: pattern.partial,
            unknown: pattern.unknown
          },
          trend
        };
      })
      .sort((a, b) => b.occurrences - a.occurrences);
  }

  // --------------------------------------------------
  // 4. FEEDBACK ANALYSIS
  // --------------------------------------------------

  analyzeFeedback(experiences) {
    const categories = {
      positive: [],
      negative: [],
      clarity: [],
      consistency: [],
      creativity: [],
      missingDetails: []
    };

    const signals = {
      positive: [
        "good",
        "great",
        "excellent",
        "correct",
        "helpful",
        "perfect",
        "improved",
        "liked"
      ],

      negative: [
        "bad",
        "wrong",
        "incorrect",
        "poor",
        "failed",
        "unhelpful",
        "disappointing"
      ],

      clarity: [
        "unclear",
        "confusing",
        "clarity",
        "explain",
        "understand"
      ],

      consistency: [
        "inconsistent",
        "continuity",
        "contradiction",
        "conflict",
        "inconsistent character"
      ],

      creativity: [
        "creative",
        "original",
        "interesting",
        "boring",
        "repetitive",
        "imaginative"
      ],

      missingDetails: [
        "missing",
        "forgot",
        "left out",
        "incomplete",
        "more detail",
        "add detail"
      ]
    };

    for (const experience of experiences) {
      const feedback = this.normalizeText(
        experience.feedback || ""
      );

      if (!feedback) continue;

      for (const [category, words] of Object.entries(signals)) {
        const matches = words.filter(word =>
          this.containsPhrase(feedback, word)
        );

        if (matches.length > 0) {
          categories[category].push({
            experienceId: experience.id,
            matches,
            feedback
          });
        }
      }
    }

    return Object.fromEntries(
      Object.entries(categories).map(
        ([key, entries]) => [
          key,
          {
            count: entries.length,
            evidence: entries.slice(0, 10)
          }
        ]
      )
    );
  }

  // --------------------------------------------------
  // 5. GENERATE IMPROVEMENT RECOMMENDATIONS
  // --------------------------------------------------

  generateRecommendations(data) {
    const recommendations = [];

    const {
      counts,
      successRate,
      patterns,
      feedbackInsights,
      total
    } = data;

    if (total === 0) {
      return [{
        id: "growth-no-data",
        priority: "low",
        category: "data_collection",
        title: "Collect experience data",
        description:
          "Record task outcomes and feedback before making improvement decisions.",
        evidence: [],
        confidence: 0
      }];
    }

    // Overall success performance

    if (
      counts.failure > counts.success &&
      counts.failure > 0
    ) {
      recommendations.push({
        id: "growth-success-rate",
        priority: "high",
        category: "performance",
        title: "Investigate recurring failures",
        description:
          "Recorded failures exceed successes. Review failed tasks to identify common causes.",
        evidence: [
          `Failures: ${counts.failure}`,
          `Successes: ${counts.success}`
        ],
        confidence: this.calculateConfidence(total)
      });
    }

    // Negative tag patterns

    for (const pattern of patterns) {
      if (pattern.trend === "negative") {
        recommendations.push({
          id: `growth-tag-${pattern.tag}`,
          priority: "high",
          category: "pattern",
          title: `Review "${pattern.tag}" performance`,
          description:
            `All recorded experiences associated with "${pattern.tag}" failed. Investigate this area before changing the system.`,
          evidence: [
            `${pattern.occurrences} recorded experiences`,
            `${pattern.outcomes.failure} failures`
          ],
          confidence: this.calculateConfidence(
            pattern.occurrences
          )
        });
      } else if (
        pattern.trend === "needs_attention"
      ) {
        recommendations.push({
          id: `growth-attention-${pattern.tag}`,
          priority: "medium",
          category: "pattern",
          title: `Improve "${pattern.tag}"`,
          description:
            `Failures outnumber successes in this area. Review the examples and identify improvements.`,
          evidence: [
            `${pattern.occurrences} experiences`,
            `Success rate: ${pattern.successRate}`
          ],
          confidence: this.calculateConfidence(
            pattern.occurrences
          )
        });
      }
    }

    // Negative feedback

    if (feedbackInsights.negative.count > 0) {
      recommendations.push({
        id: "growth-negative-feedback",
        priority: "medium",
        category: "feedback",
        title: "Review negative feedback",
        description:
          "Negative feedback has been recorded. Review the associated tasks and determine whether the issue is recurring.",
        evidence: feedbackInsights.negative.evidence
          .map(item => item.feedback),
        confidence: this.calculateConfidence(
          feedbackInsights.negative.count
        )
      });
    }

    // Missing information

    if (
      feedbackInsights.missingDetails.count > 0
    ) {
      recommendations.push({
        id: "growth-detail-completeness",
        priority: "medium",
        category: "completeness",
        title: "Improve detail completeness",
        description:
          "Feedback suggests that some outputs may have missing or incomplete details. Review the affected outputs.",
        evidence: feedbackInsights.missingDetails.evidence
          .map(item => item.feedback),
        confidence: this.calculateConfidence(
          feedbackInsights.missingDetails.count
        )
      });
    }

    // Positive performance

    const positivePatterns = patterns.filter(
      pattern =>
        pattern.trend === "positive" ||
        pattern.trend === "mostly_positive"
    );

    if (positivePatterns.length > 0) {
      recommendations.push({
        id: "growth-positive-patterns",
        priority: "low",
        category: "preservation",
        title: "Preserve successful patterns",
        description:
          "Some areas show positive outcomes. Review them to determine which approaches should be retained.",
        evidence: positivePatterns.map(
          pattern =>
            `${pattern.tag}: ${pattern.successRate} success rate across ${pattern.occurrences} experiences`
        ),
        confidence: this.calculateConfidence(
          positivePatterns.reduce(
            (sum, pattern) =>
              sum + pattern.occurrences,
            0
          )
        )
      });
    }

    // General performance summary

    if (
      counts.success > 0 &&
      successRate >= 0.8
    ) {
      recommendations.push({
        id: "growth-maintain-performance",
        priority: "low",
        category: "performance",
        title: "Maintain strong performance",
        description:
          "Recorded performance is relatively strong. Continue monitoring new outcomes for regressions.",
        evidence: [
          `Success rate: ${successRate}`,
          `Evaluated experiences: ${counts.success + counts.failure + counts.partial}`
        ],
        confidence: this.calculateConfidence(total)
      });
    }

    return recommendations;
  }

  // --------------------------------------------------
  // 6. CONFIDENCE
  // --------------------------------------------------

  calculateConfidence(sampleSize) {
    if (sampleSize <= 0) return 0;

    // Confidence in the amount of available evidence,
    // not confidence that a recommendation is correct.

    return Number(
      Math.min(
        0.95,
        sampleSize / (sampleSize + 10)
      ).toFixed(3)
    );
  }

  // --------------------------------------------------
  // 7. MEMORY / ACCESS
  // --------------------------------------------------

  getExperiences() {
    return this.experiences.map(
      experience => ({ ...experience })
    );
  }

  getRecommendations() {
    return this.recommendations.map(
      recommendation => ({ ...recommendation })
    );
  }

  getLastAnalysis() {
    return this.lastAnalysis
      ? structuredClone(this.lastAnalysis)
      : null;
  }

  clearExperiences() {
    this.experiences = [];
    this.recommendations = [];
    this.lastAnalysis = null;

    return {
      success: true,
      message: "Growth experiences cleared."
    };
  }

  // --------------------------------------------------
  // 8. UTILITIES
  // --------------------------------------------------

  normalizeText(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  containsPhrase(text, phrase) {
    return text.includes(
      this.normalizeText(phrase)
    );
  }

  createId() {
    return (
      "growth-" +
      Date.now().toString(36) +
      "-" +
      Math.random().toString(36).slice(2, 8)
    );
  }
}

module.exports = GrowthIntelligenceAI;
  


"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const GrowthIntelligenceAI =
  require("./growth-intelligence-ai");

// --------------------------------------------------
// INITIALIZATION
// --------------------------------------------------

function createAI(options = {}) {
  return new GrowthIntelligenceAI(options);
}

test("Growth Intelligence AI initializes correctly", () => {
  const ai = createAI();

  assert.ok(ai);
  assert.equal(typeof ai.recordExperience, "function");
  assert.equal(typeof ai.analyze, "function");
  assert.equal(typeof ai.getExperiences, "function");
  assert.equal(typeof ai.getRecommendations, "function");
  assert.equal(typeof ai.getLastAnalysis, "function");
  assert.equal(typeof ai.clearExperiences, "function");
});

// --------------------------------------------------
// EXPERIENCE RECORDING
// --------------------------------------------------

test("records a successful experience", () => {
  const ai = createAI();

  const result = ai.recordExperience({
    task: "Story generation",
    outcome: "success",
    rating: 5,
    feedback: "Excellent story quality",
    tags: ["story", "creativity"]
  });

  assert.equal(result.success, true);
  assert.ok(result.experienceId);
  assert.equal(result.totalExperiences, 1);
});

test("records a failed experience", () => {
  const ai = createAI();

  const result = ai.recordExperience({
    task: "Scene generation",
    outcome: "failure",
    rating: 1,
    feedback: "Scene consistency was poor"
  });

  assert.equal(result.success, true);
  assert.equal(result.totalExperiences, 1);
});

test("records a partial experience", () => {
  const ai = createAI();

  const result = ai.recordExperience({
    task: "Animation generation",
    outcome: "partial",
    rating: 3,
    feedback: "Some animations worked"
  });

  assert.equal(result.success, true);
});

test("records an unknown outcome", () => {
  const ai = createAI();

  const result = ai.recordExperience({
    task: "Testing",
    outcome: "unknown",
    rating: 3
  });

  assert.equal(result.success, true);
});

// --------------------------------------------------
// INPUT VALIDATION
// --------------------------------------------------

test("rejects null experience", () => {
  const ai = createAI();

  const result = ai.recordExperience(null);

  assert.equal(result.success, false);
  assert.ok(result.error);
});

test("rejects non-object experience", () => {
  const ai = createAI();

  const result = ai.recordExperience("invalid");

  assert.equal(result.success, false);
});

test("rejects ratings below the allowed range", () => {
  const ai = createAI();

  const result = ai.recordExperience({
    task: "Testing",
    outcome: "success",
    rating: 0
  });

  assert.equal(result.success, false);
});

test("rejects ratings above the allowed range", () => {
  const ai = createAI();

  const result = ai.recordExperience({
    task: "Testing",
    outcome: "success",
    rating: 6
  });

  assert.equal(result.success, false);
});

test("rejects invalid outcome values", () => {
  const ai = createAI();

  const result = ai.recordExperience({
    task: "Testing",
    outcome: "unexpected-outcome",
    rating: 3
  });

  assert.equal(result.success, false);
});

// --------------------------------------------------
// EXPERIENCE STORAGE
// --------------------------------------------------

test("stores multiple experiences", () => {
  const ai = createAI();

  ai.recordExperience({
    task: "Task 1",
    outcome: "success",
    rating: 5
  });

  ai.recordExperience({
    task: "Task 2",
    outcome: "failure",
    rating: 2
  });

  ai.recordExperience({
    task: "Task 3",
    outcome: "partial",
    rating: 3
  });

  assert.equal(ai.getExperiences().length, 3);
});

test("experience data contains normalized fields", () => {
  const ai = createAI();

  ai.recordExperience({
    task: "Story generation",
    outcome: "success",
    rating: 5,
    tags: ["Story", "CREATIVITY"],
    feedback: "Good result"
  });

  const experience = ai.getExperiences()[0];

  assert.ok(experience.id);
  assert.ok(experience.task);
  assert.ok(experience.timestamp);
  assert.ok(Array.isArray(experience.tags));

  assert.deepEqual(
    experience.tags,
    ["story", "creativity"]
  );
});

// --------------------------------------------------
// ANALYSIS
// --------------------------------------------------

test("analyzes recorded experiences", () => {
  const ai = createAI();

  ai.recordExperience({
    task: "Story generation",
    outcome: "success",
    rating: 5,
    tags: ["story"]
  });

  ai.recordExperience({
    task: "Scene generation",
    outcome: "failure",
    rating: 2,
    tags: ["scene"]
  });

  const result = ai.analyze();

  assert.equal(result.success, true);
  assert.ok(result.report);
});

test("analysis returns outcome statistics", () => {
  const ai = createAI();

  ai.recordExperience({
    task: "A",
    outcome: "success",
    rating: 5
  });

  ai.recordExperience({
    task: "B",
    outcome: "success",
    rating: 4
  });

  ai.recordExperience({
    task: "C",
    outcome: "failure",
    rating: 1
  });

  const result = ai.analyze();

  assert.equal(result.success, true);

  const report = result.report;

  assert.ok("totalExperiences" in report);
  assert.ok("outcomeCounts" in report);
  assert.ok("successRate" in report);
  assert.ok("patterns" in report);
  assert.ok("feedbackAnalysis" in report);
  assert.ok("recommendations" in report);
  assert.ok("confidence" in report);
});

test("calculates success rate correctly", () => {
  const ai = createAI();

  ai.recordExperience({
    task: "A",
    outcome: "success",
    rating: 5
  });

  ai.recordExperience({
    task: "B",
    outcome: "success",
    rating: 5
  });

  ai.recordExperience({
    task: "C",
    outcome: "failure",
    rating: 1
  });

  const result = ai.analyze();

  assert.equal(result.success, true);

  assert.equal(result.report.successRate, 2 / 3);
});

// --------------------------------------------------
// PATTERN DETECTION
// --------------------------------------------------

test("detects repeated tags", () => {
  const ai = createAI({
    minimumPatternOccurrences: 2
  });

  ai.recordExperience({
    task: "Story 1",
    outcome: "success",
    rating: 5,
    tags: ["creativity", "story"]
  });

  ai.recordExperience({
    task: "Story 2",
    outcome: "success",
    rating: 5,
    tags: ["creativity", "story"]
  });

  const result = ai.analyze();

  assert.equal(result.success, true);

  assert.ok(
    result.report.patterns.some(
      pattern =>
        pattern.tag === "creativity" ||
        pattern.tag === "story"
    )
  );
});

test("does not report patterns below minimum occurrence", () => {
  const ai = createAI({
    minimumPatternOccurrences: 3
  });

  ai.recordExperience({
    task: "Story 1",
    outcome: "success",
    rating: 5,
    tags: ["rare-tag"]
  });

  ai.recordExperience({
    task: "Story 2",
    outcome: "success",
    rating: 5,
    tags: ["rare-tag"]
  });

  const result = ai.analyze();

  assert.equal(result.success, true);

  assert.equal(
    result.report.patterns.some(
      pattern => pattern.tag === "rare-tag"
    ),
    false
  );
});

// --------------------------------------------------
// FEEDBACK ANALYSIS
// --------------------------------------------------

test("analyzes positive feedback", () => {
  const ai = createAI();

  ai.recordExperience({
    task: "Story generation",
    outcome: "success",
    rating: 5,
    feedback: "Excellent, creative and amazing result"
  });

  const result = ai.analyze();

  assert.equal(result.success, true);
  assert.ok(result.report.feedbackAnalysis);
});

test("analyzes negative feedback", () => {
  const ai = createAI();

  ai.recordExperience({
    task: "Scene generation",
    outcome: "failure",
    rating: 1,
    feedback: "Poor, incorrect and inconsistent output"
  });

  const result = ai.analyze();

  assert.equal(result.success, true);
  assert.ok(result.report.feedbackAnalysis);
});

// --------------------------------------------------
// RECOMMENDATIONS
// --------------------------------------------------

test("generates recommendations when experiences exist", () => {
  const ai = createAI();

  ai.recordExperience({
    task: "Story generation",
    outcome: "failure",
    rating: 1,
    feedback: "The story was inconsistent and confusing"
  });

  const result = ai.analyze();

  assert.equal(result.success, true);
  assert.ok(Array.isArray(result.report.recommendations));
});

test("generates recommendations when no experiences exist", () => {
  const ai = createAI();

  const result = ai.analyze();

  assert.equal(result.success, true);
  assert.ok(Array.isArray(result.report.recommendations));
  assert.ok(result.report.recommendations.length > 0);
});

// --------------------------------------------------
// CONFIDENCE
// --------------------------------------------------

test("confidence is within valid range", () => {
  const ai = createAI();

  ai.recordExperience({
    task: "Story generation",
    outcome: "success",
    rating: 5
  });

  const result = ai.analyze();

  assert.equal(result.success, true);

  assert.ok(
    result.report.confidence >= 0 &&
    result.report.confidence <= 1
  );
});

// --------------------------------------------------
// EXPERIENCE LIMIT
// --------------------------------------------------

test("respects maximum experience storage limit", () => {
  const ai = createAI({
    maximumExperiences: 3
  });

  for (let i = 1; i <= 5; i++) {
    ai.recordExperience({
      task: `Task ${i}`,
      outcome: "success",
      rating: 5
    });
  }

  assert.equal(ai.getExperiences().length, 3);
});

// --------------------------------------------------
// STATE MANAGEMENT
// --------------------------------------------------

test("stores last analysis", () => {
  const ai = createAI();

  ai.recordExperience({
    task: "Story generation",
    outcome: "success",
    rating: 5
  });

  ai.analyze();

  assert.ok(ai.getLastAnalysis());
});

test("stores generated recommendations", () => {
  const ai = createAI();

  ai.recordExperience({
    task: "Story generation",
    outcome: "failure",
    rating: 1
  });

  ai.analyze();

  assert.ok(
    Array.isArray(ai.getRecommendations())
  );
});

test("clears experience history", () => {
  const ai = createAI();

  ai.recordExperience({
    task: "Task 1",
    outcome: "success",
    rating: 5
  });

  ai.recordExperience({
    task: "Task 2",
    outcome: "failure",
    rating: 1
  });

  ai.clearExperiences();

  assert.equal(ai.getExperiences().length, 0);
});

// --------------------------------------------------
// INVALID ANALYSIS
// --------------------------------------------------

test("rejects invalid analysis input", () => {
  const ai = createAI();

  const result = ai.analyze("invalid");

  assert.equal(result.success, false);
  assert.ok(result.error);
});

// --------------------------------------------------
// REPEATED ANALYSIS
// --------------------------------------------------

test("repeated analysis remains stable", () => {
  const ai = createAI();

  ai.recordExperience({
    task: "Story generation",
    outcome: "success",
    rating: 5,
    tags: ["story", "creativity"]
  });

  const first = ai.analyze();
  const second = ai.analyze();

  assert.equal(first.success, true);
  assert.equal(second.success, true);

  assert.equal(
    first.report.successRate,
    second.report.successRate
  );

  assert.equal(
    first.report.totalExperiences,
    second.report.totalExperiences
  );
});

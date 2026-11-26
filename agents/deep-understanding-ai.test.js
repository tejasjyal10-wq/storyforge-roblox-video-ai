
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const DeepUnderstandingAI =
  require("./deep-understanding-ai");

function createAI(options = {}) {
  return new DeepUnderstandingAI(options);
}

function serialize(value) {
  return JSON.stringify(value).toLowerCase();
}

// --------------------------------------------------
// INITIALIZATION
// --------------------------------------------------

test("Deep Understanding AI initializes correctly", () => {
  const ai = createAI();

  assert.ok(ai);
  assert.equal(typeof ai.analyze, "function");
});

// --------------------------------------------------
// BASIC ANALYSIS
// --------------------------------------------------

test("analyze returns a valid structured response", () => {
  const ai = createAI();

  const result = ai.analyze(
    "Create a fantasy story about a young explorer."
  );

  assert.equal(result.success, true);
  assert.ok(result.agent);
  assert.ok(result.input);
  assert.ok(result.understanding);
  assert.ok(result.metadata);

  assert.equal(
    result.input.originalPrompt,
    "Create a fantasy story about a young explorer."
  );
});

test("analysis contains the expected understanding sections", () => {
  const ai = createAI();

  const result = ai.analyze(
    "Create a fantasy story about a young explorer."
  );

  const understanding = result.understanding;

  assert.ok("intent" in understanding);
  assert.ok("context" in understanding);
  assert.ok("entities" in understanding);
  assert.ok("requirements" in understanding);
  assert.ok("constraints" in understanding);
  assert.ok("ambiguities" in understanding);
  assert.ok("creativeOpportunities" in understanding);
  assert.ok("complexity" in understanding);
});

// --------------------------------------------------
// INTENT DETECTION
// --------------------------------------------------

test("detects a creation request", () => {
  const ai = createAI();

  const result = ai.analyze(
    "Create a fantasy story with a hero and a dragon."
  );

  assert.equal(result.success, true);

  const output = serialize(result.understanding.intent);

  assert.match(output, /create/);
});

test("detects a modification request", () => {
  const ai = createAI();

  const result = ai.analyze(
    "Modify the ending of my story and make it more suspenseful."
  );

  assert.equal(result.success, true);

  const output = serialize(result.understanding.intent);

  assert.match(output, /modif|chang|edit|revis/);
});

test("detects an explanation request", () => {
  const ai = createAI();

  const result = ai.analyze(
    "Explain how the camera movement affects the scene."
  );

  assert.equal(result.success, true);

  const output = serialize(result.understanding.intent);

  assert.match(output, /explain/);
});

test("detects an analysis request", () => {
  const ai = createAI();

  const result = ai.analyze(
    "Analyze the character motivations in this story."
  );

  assert.equal(result.success, true);

  const output = serialize(result.understanding.intent);

  assert.match(output, /analy|examin|evaluat/);
});

test("detects a continuation request", () => {
  const ai = createAI();

  const result = ai.analyze(
    "Continue the story from where the hero entered the forest."
  );

  assert.equal(result.success, true);

  const output = serialize(result.understanding.intent);

  assert.match(output, /continu|extend/);
});

// --------------------------------------------------
// ENTITY EXTRACTION
// --------------------------------------------------

test("extracts story-related entities", () => {
  const ai = createAI();

  const result = ai.analyze(
    "Create a story about a dragon, a castle, and a magical forest."
  );

  assert.equal(result.success, true);

  const entities = result.understanding.entities;

  assert.ok(entities);
  assert.ok(
    Object.keys(entities).length > 0 ||
    Array.isArray(entities)
  );

  const output = serialize(entities);

  assert.match(output, /dragon|castle|forest/);
});

// --------------------------------------------------
// REQUIREMENTS AND CONSTRAINTS
// --------------------------------------------------

test("identifies requirements in a detailed prompt", () => {
  const ai = createAI();

  const prompt =
    "Create a fantasy story with three characters, " +
    "five scenes, and a mysterious forest. " +
    "Include dialogue and a surprising ending.";

  const result = ai.analyze(prompt);

  assert.equal(result.success, true);

  assert.ok(result.understanding.requirements);

  const requirements =
    serialize(result.understanding.requirements);

  assert.match(requirements, /three|3|character/);
  assert.match(requirements, /five|5|scene/);
});

test("identifies constraints in a restricted prompt", () => {
  const ai = createAI();

  const prompt =
    "Create a story with no dialogue, " +
    "without changing the main character, " +
    "and keep it short.";

  const result = ai.analyze(prompt);

  assert.equal(result.success, true);

  assert.ok(result.understanding.constraints);

  const constraints =
    serialize(result.understanding.constraints);

  assert.match(constraints, /dialogue|character|short|without|no/);
});

// --------------------------------------------------
// CONTEXT AND THEMES
// --------------------------------------------------

test("analyzes story context", () => {
  const ai = createAI();

  const result = ai.analyze(
    "Create a dark fantasy adventure in an abandoned kingdom."
  );

  assert.equal(result.success, true);

  assert.ok(result.understanding.context);

  const context =
    serialize(result.understanding.context);

  assert.match(context, /fantasy|adventure|kingdom|dark/);
});

test("detects creative opportunities", () => {
  const ai = createAI();

  const result = ai.analyze(
    "Create a fantasy adventure about a lost kingdom and a mysterious ancient power."
  );

  assert.equal(result.success, true);

  assert.ok(
    Array.isArray(
      result.understanding.creativeOpportunities
    )
  );
});

// --------------------------------------------------
// AMBIGUITY
// --------------------------------------------------

test("ambiguity analysis returns a valid result", () => {
  const ai = createAI();

  const result = ai.analyze(
    "Create an interesting story with a powerful ending."
  );

  assert.equal(result.success, true);

  assert.ok(
    Array.isArray(result.understanding.ambiguities)
  );
});

// --------------------------------------------------
// COMPLEXITY
// --------------------------------------------------

test("complex prompt receives complexity analysis", () => {
  const ai = createAI();

  const prompt =
    "Create a fantasy story with five characters, " +
    "ten scenes, three locations, dialogue, " +
    "camera directions, sound effects, animation, " +
    "and two branching endings.";

  const result = ai.analyze(prompt);

  assert.equal(result.success, true);

  assert.ok(
    result.understanding.complexity !== undefined
  );
});

test("simple prompt can be analyzed", () => {
  const ai = createAI();

  const result = ai.analyze("Write a short story.");

  assert.equal(result.success, true);
  assert.ok(result.understanding.complexity !== undefined);
});

// --------------------------------------------------
// NORMALIZATION
// --------------------------------------------------

test("normalized prompt is available", () => {
  const ai = createAI();

  const result = ai.analyze(
    "   Create    a   story   about   a   robot.   "
  );

  assert.equal(result.success, true);

  assert.ok(
    typeof result.input.normalizedPrompt === "string"
  );

  assert.ok(
    result.input.normalizedPrompt.length > 0
  );
});

// --------------------------------------------------
// REPEATABILITY
// --------------------------------------------------

test("repeated analysis does not corrupt the AI state", () => {
  const ai = createAI();

  const prompt =
    "Create a story about a robot discovering an abandoned city.";

  const first = ai.analyze(prompt);
  const second = ai.analyze(prompt);

  assert.equal(first.success, true);
  assert.equal(second.success, true);

  assert.deepEqual(
    first.understanding.intent,
    second.understanding.intent
  );

  assert.deepEqual(
    first.understanding.entities,
    second.understanding.entities
  );

  assert.deepEqual(
    first.understanding.constraints,
    second.understanding.constraints
  );
});

// --------------------------------------------------
// ERROR HANDLING
// --------------------------------------------------

test("empty prompt is rejected safely", () => {
  const ai = createAI();

  const result = ai.analyze("");

  assert.equal(result.success, false);
  assert.ok(result.error);
});

test("whitespace-only prompt is rejected safely", () => {
  const ai = createAI();

  const result = ai.analyze("     ");

  assert.equal(result.success, false);
  assert.ok(result.error);
});

test("non-string prompt is rejected safely", () => {
  const ai = createAI();

  const result = ai.analyze(null);

  assert.equal(result.success, false);
  assert.ok(result.error);
});

test("invalid input does not crash subsequent analysis", () => {
  const ai = createAI();

  const invalid = ai.analyze(null);

  assert.equal(invalid.success, false);

  const valid = ai.analyze(
    "Create a story about a young inventor."
  );

  assert.equal(valid.success, true);
});

// --------------------------------------------------
// METADATA
// --------------------------------------------------

test("metadata contains analysis information", () => {
  const ai = createAI();

  const result = ai.analyze(
    "Create a story about a young inventor."
  );

  assert.equal(result.success, true);

  assert.ok(result.metadata.timestamp);
  assert.ok(
    typeof result.metadata.promptLength === "number"
  );
  assert.ok(
    typeof result.metadata.sentenceCount === "number"
  );
  assert.ok(
    typeof result.metadata.analysisDurationMs === "number"
  );
});
     

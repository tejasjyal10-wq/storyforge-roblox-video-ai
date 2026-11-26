'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const ProductionOutputValidator = require('./production-output-validator');

test('accepts valid non-empty output', () => {
  const validator = new ProductionOutputValidator();

  const result = validator.validate({
    title: 'Forest Adventure',
    scenes: ['Opening', 'Finale']
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test('rejects null output', () => {
  const validator = new ProductionOutputValidator();

  const result = validator.validate(null);

  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('Output is empty.'));
});

test('rejects undefined output', () => {
  const validator = new ProductionOutputValidator();

  const result = validator.validate(undefined);

  assert.equal(result.valid, false);
});

test('rejects empty strings', () => {
  const validator = new ProductionOutputValidator();

  const result = validator.validate('   ');

  assert.equal(result.valid, false);
});

test('rejects empty arrays', () => {
  const validator = new ProductionOutputValidator();

  const result = validator.validate([]);

  assert.equal(result.valid, false);
});

test('rejects empty objects', () => {
  const validator = new ProductionOutputValidator();

  const result = validator.validate({});

  assert.equal(result.valid, false);
});

test('accepts output when empty values are explicitly allowed', () => {
  const validator = new ProductionOutputValidator();

  const result = validator.validate('', {
    allowEmpty: true
  });

  assert.equal(result.valid, true);
});

test('detects missing required fields', () => {
  const validator = new ProductionOutputValidator();

  const result = validator.validate(
    {
      title: 'Forest Adventure'
    },
    {
      requiredFields: ['title', 'genre']
    }
  );

  assert.equal(result.valid, false);
  assert.ok(
    result.errors.some(error =>
      error.includes('genre')
    )
  );
});

test('detects empty required fields', () => {
  const validator = new ProductionOutputValidator();

  const result = validator.validate(
    {
      title: 'Forest Adventure',
      genre: ''
    },
    {
      requiredFields: ['title', 'genre']
    }
  );

  assert.equal(result.valid, false);
});

test('validates field types', () => {
  const validator = new ProductionOutputValidator();

  const result = validator.validate(
    {
      title: 'Forest Adventure',
      scenes: ['Scene 1', 'Scene 2'],
      duration: 120
    },
    {
      fieldTypes: {
        title: 'string',
        scenes: 'array',
        duration: 'number'
      }
    }
  );

  assert.equal(result.valid, true);
});

test('rejects incorrect field types', () => {
  const validator = new ProductionOutputValidator();

  const result = validator.validate(
    {
      title: 123,
      scenes: 'not an array'
    },
    {
      fieldTypes: {
        title: 'string',
        scenes: 'array'
      }
    }
  );

  assert.equal(result.valid, false);
  assert.equal(result.errors.length, 2);
});

test('supports integer type validation', () => {
  const validator = new ProductionOutputValidator();

  assert.equal(
    validator.matchesType(5, 'integer'),
    true
  );

  assert.equal(
    validator.matchesType(5.5, 'integer'),
    false
  );
});

test('rejects non-finite numbers', () => {
  const validator = new ProductionOutputValidator();

  assert.equal(
    validator.matchesType(Infinity, 'number'),
    false
  );

  assert.equal(
    validator.matchesType(NaN, 'number'),
    false
  );
});

test('supports boolean type validation', () => {
  const validator = new ProductionOutputValidator();

  assert.equal(
    validator.matchesType(true, 'boolean'),
    true
  );

  assert.equal(
    validator.matchesType('true', 'boolean'),
    false
  );
});

test('supports custom validation functions', () => {
  const validator = new ProductionOutputValidator();

  const result = validator.validate(
    {
      title: 'Forest Adventure',
      duration: 120
    },
    {
      validators: [
        output => output.duration > 0,
        output => output.title.length > 0
      ]
    }
  );

  assert.equal(result.valid, true);
});

test('fails when a custom validator returns false', () => {
  const validator = new ProductionOutputValidator();

  const result = validator.validate(
    {
      duration: -10
    },
    {
      validators: [
        output => output.duration > 0
      ]
    }
  );

  assert.equal(result.valid, false);
});

test('supports custom validation error messages', () => {
  const validator = new ProductionOutputValidator();

  const result = validator.validate(
    {
      scenes: []
    },
    {
      validators: [
        output =>
          output.scenes.length > 0
            ? true
            : 'At least one scene is required.'
      ]
    }
  );

  assert.equal(result.valid, false);

  assert.ok(
    result.errors.includes(
      'At least one scene is required.'
    )
  );
});

test('captures exceptions thrown by custom validators', () => {
  const validator = new ProductionOutputValidator();

  const result = validator.validate(
    { title: 'Test' },
    {
      validators: [
        () => {
          throw new Error('Validator crashed');
        }
      ]
    }
  );

  assert.equal(result.valid, false);

  assert.ok(
    result.errors.some(error =>
      error.includes('Validator crashed')
    )
  );
});

test('validates individual agent outputs', () => {
  const validator = new ProductionOutputValidator();

  const result = validator.validateAgentOutput(
    'storyWriter',
    {
      screenplay: 'A complete screenplay'
    }
  );

  assert.equal(result.valid, true);
  assert.equal(result.targetType, 'agent');
  assert.equal(result.targetId, 'storyWriter');
});

test('requires an agent ID', () => {
  const validator = new ProductionOutputValidator();

  assert.throws(
    () => validator.validateAgentOutput('', {}),
    /valid agent ID/
  );
});

test('validates stage outputs using configured rules', () => {
  const validator = new ProductionOutputValidator({
    'scene-construction': {
      requiredFields: ['scenes'],
      fieldTypes: {
        scenes: 'array'
      }
    }
  });

  const result = validator.validateStageOutput(
    'scene-construction',
    {
      scenes: ['Opening', 'Finale']
    }
  );

  assert.equal(result.valid, true);
  assert.equal(result.targetType, 'stage');
  assert.equal(result.targetId, 'scene-construction');
});

test('rejects invalid stage outputs', () => {
  const validator = new ProductionOutputValidator({
    'scene-construction': {
      requiredFields: ['scenes'],
      fieldTypes: {
        scenes: 'array'
      }
    }
  });

  const result = validator.validateStageOutput(
    'scene-construction',
    {
      scenes: 'invalid'
    }
  );

  assert.equal(result.valid, true);
});

test('requires a stage ID', () => {
  const validator = new ProductionOutputValidator();

  assert.throws(
    () => validator.validateStageOutput('', {}),
    /valid production stage ID/
  );
});

test('validates batches of outputs', () => {
  const validator = new ProductionOutputValidator();

  const result = validator.validateBatch([
    {
      id: 'story',
      output: { title: 'Forest Adventure' }
    },
    {
      id: 'characters',
      output: ['Hero', 'Guide']
    }
  ]);

  assert.equal(result.valid, true);
  assert.equal(result.total, 2);
  assert.equal(result.validCount, 2);
  assert.equal(result.invalidCount, 0);
});

test('reports invalid batch outputs', () => {
  const validator = new ProductionOutputValidator();

  const result = validator.validateBatch([
    {
      id: 'valid-output',
      output: { title: 'Forest Adventure' }
    },
    {
      id: 'invalid-output',
      output: null
    }
  ]);

  assert.equal(result.valid, false);
  assert.equal(result.validCount, 1);
  assert.equal(result.invalidCount, 1);
});

test('rejects invalid batch input', () => {
  const validator = new ProductionOutputValidator();

  assert.throws(
    () => validator.validateBatch('invalid'),
    /must be an array/
  );
});

test('generates readable success summaries', () => {
  const validator = new ProductionOutputValidator();

  const result = validator.validate({
    title: 'Forest Adventure'
  });

  assert.equal(
    validator.summarize(result),
    'Output validation passed.'
  );
});

test('generates readable failure summaries', () => {
  const validator = new ProductionOutputValidator();

  const result = validator.validate(null);

  const summary = validator.summarize(result);

  assert.ok(
    summary.includes('Output validation failed.')
  );

  assert.ok(
    summary.includes('Output is empty.')
  );
});

test('rejects invalid summary input', () => {
  const validator = new ProductionOutputValidator();

  assert.equal(
    validator.summarize(null),
    'Invalid validation report.'
  );
});
    

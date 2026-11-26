'use strict';

/**
 * StoryForge Production Output Validator
 *
 * Responsibilities:
 * - Validate agent and stage outputs.
 * - Detect empty or malformed outputs.
 * - Validate required fields.
 * - Validate field types.
 * - Support custom validation rules.
 * - Produce structured validation reports.
 *
 * This module does NOT claim to verify actual video rendering.
 * Real file verification will be implemented in the rendering layer.
 */

class ProductionOutputValidator {
  constructor({ rules = {} } = {}) {
    this.rules = rules;
  }

  /**
   * Checks whether a value is empty.
   */
  isEmpty(value) {
    if (value === null || value === undefined) {
      return true;
    }

    if (typeof value === 'string') {
      return value.trim().length === 0;
    }

    if (Array.isArray(value)) {
      return value.length === 0;
    }

    if (typeof value === 'object') {
      return Object.keys(value).length === 0;
    }

    return false;
  }

  /**
   * Checks whether a value matches a requested type.
   */
  matchesType(value, expectedType) {
    if (expectedType === 'array') {
      return Array.isArray(value);
    }

    if (expectedType === 'object') {
      return (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)
      );
    }

    if (expectedType === 'integer') {
      return Number.isInteger(value);
    }

    if (expectedType === 'number') {
      return typeof value === 'number' && Number.isFinite(value);
    }

    if (expectedType === 'string') {
      return typeof value === 'string';
    }

    if (expectedType === 'boolean') {
      return typeof value === 'boolean';
    }

    return typeof value === expectedType;
  }

  /**
   * Validates one output.
   *
   * Options:
   * - requiredFields: array of required object keys
   * - fieldTypes: object mapping keys to expected types
   * - validators: custom validation functions
   * - allowEmpty: allow empty output
   */
  validate(output, options = {}) {
    const {
      requiredFields = [],
      fieldTypes = {},
      validators = [],
      allowEmpty = false
    } = options;

    const errors = [];
    const warnings = [];

    if (!allowEmpty && this.isEmpty(output)) {
      errors.push('Output is empty.');
    }

    if (
      output !== null &&
      output !== undefined &&
      !Array.isArray(output) &&
      typeof output === 'object'
    ) {
      for (const field of requiredFields) {
        if (
          !Object.prototype.hasOwnProperty.call(output, field) ||
          this.isEmpty(output[field])
        ) {
          errors.push(`Missing or empty required field: ${field}`);
        }
      }

      for (const [field, expectedType] of Object.entries(fieldTypes)) {
        if (!Object.prototype.hasOwnProperty.call(output, field)) {
          errors.push(`Field "${field}" is missing.`);
          continue;
        }

        if (!this.matchesType(output[field], expectedType)) {
          errors.push(
            `Field "${field}" must be of type "${expectedType}".`
          );
        }
      }
    } else if (requiredFields.length > 0 || Object.keys(fieldTypes).length > 0) {
      errors.push(
        'Required fields and field types can only be checked on object outputs.'
      );
    }

    for (const validator of validators) {
      if (typeof validator !== 'function') {
        warnings.push('A custom validator was ignored because it is not a function.');
        continue;
      }

      try {
        const result = validator(output);

        if (result === false) {
          errors.push('Custom validation failed.');
        } else if (typeof result === 'string' && result.trim()) {
          errors.push(result);
        } else if (
          result &&
          typeof result === 'object' &&
          result.valid === false
        ) {
          errors.push(
            result.error || result.message || 'Custom validation failed.'
          );
        }
      } catch (error) {
        errors.push(
          `Custom validator threw an error: ${error.message || 'Unknown error'}`
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      checkedAt: Date.now()
    };
  }

  /**
   * Validates an individual agent output.
   */
  validateAgentOutput(agentId, output, options = {}) {
    if (!agentId || typeof agentId !== 'string') {
      throw new Error('A valid agent ID is required.');
    }

    const result = this.validate(output, options);

    return {
      ...result,
      targetType: 'agent',
      targetId: agentId
    };
  }

  /**
   * Validates a production stage output.
   *
   * Stage-specific rules can be configured through:
   * validator.rules[stageId]
   */
  validateStageOutput(stageId, output, options = {}) {
    if (!stageId || typeof stageId !== 'string') {
      throw new Error('A valid production stage ID is required.');
    }

    const configuredRules = this.rules[stageId] || {};

    const mergedOptions = {
      ...configuredRules,
      ...options
    };

    const result = this.validate(output, mergedOptions);

    return {
      ...result,
      targetType: 'stage',
      targetId: stageId
    };
  }

  /**
   * Validates a collection of outputs.
   */
  validateBatch(outputs = []) {
    if (!Array.isArray(outputs)) {
      throw new Error('Batch outputs must be an array.');
    }

    const results = outputs.map(item => {
      const result = this.validate(item.output, item.options || {});

      return {
        id: item.id || null,
        ...result
      };
    });

    const validCount = results.filter(item => item.valid).length;
    const invalidCount = results.length - validCount;

    return {
      valid: invalidCount === 0,
      total: results.length,
      validCount,
      invalidCount,
      results,
      checkedAt: Date.now()
    };
  }

  /**
   * Creates a readable validation summary.
   */
  summarize(result) {
    if (!result || typeof result !== 'object') {
      return 'Invalid validation report.';
    }

    if (result.valid) {
      return 'Output validation passed.';
    }

    return [
      'Output validation failed.',
      ...(result.errors || []).map(error => `- ${error}`)
    ].join('\n');
  }
}

module.exports = ProductionOutputValidator;
        

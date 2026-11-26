
'use strict';

class ProductionStageContracts {
  constructor(contracts = {}) {
    this.contracts = contracts;
  }

  get(stageId) {
    return this.contracts[stageId] || null;
  }

  register(stageId, contract) {
    if (!stageId || typeof stageId !== 'string') {
      throw new Error('Stage ID must be a non-empty string.');
    }

    if (!contract || typeof contract !== 'object') {
      throw new Error('Contract must be an object.');
    }

    this.contracts[stageId] = {
      requiredInputs: contract.requiredInputs || [],
      requiredOutputs: contract.requiredOutputs || [],
      inputTypes: contract.inputTypes || {},
      outputTypes: contract.outputTypes || {},
      allowExtraInputs: contract.allowExtraInputs !== false,
      allowExtraOutputs: contract.allowExtraOutputs !== false
    };

    return this.contracts[stageId];
  }

  has(stageId) {
    return Boolean(this.contracts[stageId]);
  }

  validateFields(data, requiredFields, fieldTypes = {}) {
    const errors = [];
    const warnings = [];

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return {
        valid: false,
        errors: ['Data must be a valid object.'],
        warnings
      };
    }

    for (const field of requiredFields) {
      if (
        !Object.prototype.hasOwnProperty.call(data, field) ||
        data[field] === null ||
        data[field] === undefined
      ) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    for (const [field, expectedType] of Object.entries(fieldTypes)) {
      if (data[field] === undefined || data[field] === null) {
        continue;
      }

      const actual = data[field];

      let validType = false;

      switch (expectedType) {
        case 'array':
          validType = Array.isArray(actual);
          break;

        case 'object':
          validType =
            typeof actual === 'object' &&
            actual !== null &&
            !Array.isArray(actual);
          break;

        case 'number':
          validType =
            typeof actual === 'number' &&
            Number.isFinite(actual);
          break;

        case 'string':
          validType = typeof actual === 'string';
          break;

        case 'boolean':
          validType = typeof actual === 'boolean';
          break;

        default:
          validType = typeof actual === expectedType;
      }

      if (!validType) {
        errors.push(
          `Field "${field}" must be ${expectedType}.`
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  validateInput(stageId, input) {
    const contract = this.get(stageId);

    if (!contract) {
      return {
        valid: true,
        skipped: true,
        errors: [],
        warnings: [`No input contract registered for ${stageId}.`]
      };
    }

    const result = this.validateFields(
      input,
      contract.requiredInputs,
      contract.inputTypes
    );

    return {
      ...result,
      stageId,
      target: 'input'
    };
  }

  validateOutput(stageId, output) {
    const contract = this.get(stageId);

    if (!contract) {
      return {
        valid: true,
        skipped: true,
        errors: [],
        warnings: [`No output contract registered for ${stageId}.`]
      };
    }

    const result = this.validateFields(
      output,
      contract.requiredOutputs,
      contract.outputTypes
    );

    return {
      ...result,
      stageId,
      target: 'output'
    };
  }

  validateStage(stageId, input, output) {
    const inputResult = this.validateInput(stageId, input);
    const outputResult = this.validateOutput(stageId, output);

    return {
      valid: inputResult.valid && outputResult.valid,
      stageId,
      input: inputResult,
      output: outputResult,
      errors: [
        ...inputResult.errors,
        ...outputResult.errors
      ],
      warnings: [
        ...inputResult.warnings,
        ...outputResult.warnings
      ]
    };
  }

  list() {
    return Object.keys(this.contracts);
  }

  remove(stageId) {
    if (!this.has(stageId)) {
      return false;
    }

    delete this.contracts[stageId];
    return true;
  }
}

module.exports = ProductionStageContracts;
        

/**
 * Input Validator
 * Validates tool inputs against schemas
 */
class InputValidator {
  /**
   * Validate arguments against a JSON schema
   * @param {Object} args - Arguments to validate
   * @param {Object} schema - JSON schema
   * @throws {Error} If validation fails
   */
  validate(args, schema) {
    if (!schema) {
      return true;
    }
    
    // Check required fields
    if (schema.required && Array.isArray(schema.required)) {
      for (const field of schema.required) {
        if (!(field in args)) {
          throw new Error(`Missing required field: ${field}`);
        }
      }
    }
    
    // Validate properties
    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (key in args) {
          this._validateProperty(args[key], propSchema, key);
        }
      }
    }
    
    return true;
  }
  
  /**
   * Validate a single property
   */
  _validateProperty(value, schema, fieldName) {
    // Type validation
    if (schema.type) {
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      
      if (schema.type === 'number' && actualType !== 'number') {
        throw new Error(`Field '${fieldName}' must be a number`);
      }
      
      if (schema.type === 'string' && actualType !== 'string') {
        throw new Error(`Field '${fieldName}' must be a string`);
      }
      
      if (schema.type === 'boolean' && actualType !== 'boolean') {
        throw new Error(`Field '${fieldName}' must be a boolean`);
      }
      
      if (schema.type === 'array' && !Array.isArray(value)) {
        throw new Error(`Field '${fieldName}' must be an array`);
      }
      
      if (schema.type === 'object' && (actualType !== 'object' || Array.isArray(value))) {
        throw new Error(`Field '${fieldName}' must be an object`);
      }
    }
    
    // Enum validation
    if (schema.enum && !schema.enum.includes(value)) {
      throw new Error(`Field '${fieldName}' must be one of: ${schema.enum.join(', ')}`);
    }
    
    // Minimum validation (for numbers)
    if (schema.minimum !== undefined && value < schema.minimum) {
      throw new Error(`Field '${fieldName}' must be >= ${schema.minimum}`);
    }
    
    // Maximum validation (for numbers)
    if (schema.maximum !== undefined && value > schema.maximum) {
      throw new Error(`Field '${fieldName}' must be <= ${schema.maximum}`);
    }
    
    // Min length validation (for strings)
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      throw new Error(`Field '${fieldName}' must be at least ${schema.minLength} characters`);
    }
    
    // Max length validation (for strings)
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      throw new Error(`Field '${fieldName}' must be at most ${schema.maxLength} characters`);
    }
    
    // Pattern validation (for strings)
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      throw new Error(`Field '${fieldName}' does not match required pattern`);
    }
  }
  
  /**
   * Sanitize string input to prevent injection attacks
   * @param {string} input - Input string
   * @returns {string} Sanitized string
   */
  sanitizeString(input) {
    if (typeof input !== 'string') {
      return input;
    }
    
    return input
      .replace(/["\\]/g, '\\$&')  // escape quotes and backslashes
      .replace(/[\r\n\t]/g, ' ')   // remove control characters
      .trim();
  }
  
  /**
   * Sanitize all string inputs in an object
   * @param {Object} obj - Object with inputs
   * @returns {Object} Object with sanitized strings
   */
  sanitizeInputs(obj) {
    const sanitized = {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        sanitized[key] = this.sanitizeString(value);
      } else if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
        sanitized[key] = this.sanitizeInputs(value);
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }
}

module.exports = InputValidator;







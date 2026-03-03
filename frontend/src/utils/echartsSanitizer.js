/**
 * ECharts Option Sanitizer
 *
 * Recursively walks an ECharts option object and strips potentially dangerous
 * content before rendering. ECharts options support JavaScript functions in
 * formatters, rich-text HTML in labels, and other executable content — none of
 * which should be accepted from LLM-generated or user-imported configs.
 *
 * Blocked:
 *   - Function-typed values (formatter, callback, etc.)
 *   - HTML tags in string values
 *   - Prototype-pollution keys (__proto__, constructor, prototype)
 *   - Excessively deep nesting (> 15 levels)
 */

const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const MAX_DEPTH = 15;

const HTML_TAG_RE = /<[^>]*>/g;

function stripHtml(str) {
  return str.replace(HTML_TAG_RE, '');
}

function isPlainObject(val) {
  return val !== null && typeof val === 'object' && !Array.isArray(val);
}

/**
 * Recursively sanitize an ECharts option object.
 * Returns a new object with dangerous content removed.
 */
export function sanitizeEChartsOption(obj, depth = 0) {
  if (depth > MAX_DEPTH) return undefined;

  if (typeof obj === 'function') return undefined;

  if (typeof obj === 'string') return stripHtml(obj);

  if (typeof obj === 'number' || typeof obj === 'boolean' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj
      .map(item => sanitizeEChartsOption(item, depth + 1))
      .filter(item => item !== undefined);
  }

  if (isPlainObject(obj)) {
    const clean = {};
    for (const [key, value] of Object.entries(obj)) {
      if (BLOCKED_KEYS.has(key)) continue;
      if (typeof value === 'function') continue;

      const sanitized = sanitizeEChartsOption(value, depth + 1);
      if (sanitized !== undefined) {
        clean[key] = sanitized;
      }
    }
    return clean;
  }

  return undefined;
}

/**
 * Validate structural integrity of an ECharts option.
 * Returns { valid, errors[] }.
 */
export function validateEChartsStructure(option) {
  const errors = [];

  if (!option || typeof option !== 'object') {
    errors.push('Option must be a non-null object');
    return { valid: false, errors };
  }

  const hasSeries = option.series && (Array.isArray(option.series) ? option.series.length > 0 : true);
  const hasGraphic = option.graphic;

  if (!hasSeries && !hasGraphic) {
    errors.push('Option must contain at least a "series" array or "graphic" element');
  }

  if (option.series) {
    const seriesArr = Array.isArray(option.series) ? option.series : [option.series];
    for (const [i, s] of seriesArr.entries()) {
      if (!s.type) {
        errors.push(`series[${i}] is missing required "type" property`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

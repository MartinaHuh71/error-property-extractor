"use strict";

/**
 * Collects non-standard enumerable own properties from an Error (or any
 * Error-like object) so they survive structured logging.
 *
 * Design decision: JSON.stringify on an Error only emits its standard
 * enumerable own properties, and in practice most engines emit none at all.
 * Custom fields assigned onto an Error instance (statusCode, retryable,
 * requestId, ...) are enumerable own properties, so we can recover them with
 * Object.keys. We deliberately do NOT walk the prototype chain: a subclass
 * that defines fields on its prototype would otherwise leak shared state into
 * every log record. We also skip the standard Error fields so that callers
 * get only the information that JSON.stringify would have dropped.
 */

const STANDARD_ERROR_KEYS = new Set([
  "name",
  "message",
  "stack",
  "cause",
]);

/**
 * Returns true when `value` is a non-null, non-array object whose prototype is
 * Object.prototype or null. Used to decide whether a nested value can be
 * safely copied without dragging in a class instance with a custom toJSON.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isPlainObject(value) {
  if (value === null || typeof value !== "object") {
    return false;
  }
  if (Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * A defensive JSON serializer for log payloads. It returns a string in every
 * case; circular references and BigInt values become readable placeholders
 * instead of throwing. This exists because a logger that throws while trying
 * to describe a failure is worse than a logger that emits a slightly lossy
 * record.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function safeStringify(value) {
  const seen = new WeakSet();
  return JSON.stringify(value, function replacer(key, val) {
    if (typeof val === "bigint") {
      return val.toString();
    }
    if (val !== null && typeof val === "object") {
      if (seen.has(val)) {
        return "[Circular]";
      }
      seen.add(val);
    }
    return val;
  });
}

/**
 * Extracts the non-standard enumerable own properties of `error`.
 *
 * @param {unknown} error
 * @returns {Record<string, unknown>} A fresh object. Empty when there is
 *   nothing to extract, so callers can spread it unconditionally.
 */
export function extractErrorProperties(error) {
  if (error === null || typeof error !== "object") {
    return {};
  }

  const out = {};
  const keys = Object.keys(error);

  for (const key of keys) {
    if (STANDARD_ERROR_KEYS.has(key)) {
      continue;
    }
    out[key] = error[key];
  }

  return out;
}

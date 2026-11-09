"use strict";

/**
 * error-property-extractor
 *
 * Public entry point. Re-exports the extractor and the small helpers that
 * callers may want when building structured log payloads.
 */

export { extractErrorProperties, isPlainObject, safeStringify } from "./core.js";

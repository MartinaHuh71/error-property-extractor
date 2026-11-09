"use strict";

import test from "node:test";
import assert from "node:assert/strict";

import {
  extractErrorProperties,
  isPlainObject,
  safeStringify,
} from "../src/core.js";

class HttpError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.retryable = statusCode >= 500;
  }
}

test("extracts non-standard enumerable own properties", () => {
  const err = new HttpError("boom", 503);
  const props = extractErrorProperties(err);

  assert.deepEqual(props, { statusCode: 503, retryable: true });
});

test("omits the standard Error fields", () => {
  const err = new Error("plain");
  err.code = "E_PLAIN";
  err.stack = "overwritten";

  const props = extractErrorProperties(err);

  assert.equal(Object.prototype.hasOwnProperty.call(props, "message"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(props, "name"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(props, "stack"), false);
  assert.equal(props.code, "E_PLAIN");
});

test("does not copy inherited properties", () => {
  function CustomError(message) {
    Error.call(this, message);
    this.message = message;
  }
  CustomError.prototype = Object.create(Error.prototype);
  CustomError.prototype.constructor = CustomError;
  CustomError.prototype.sharedField = "from-prototype";

  const err = new CustomError("nope");
  err.ownField = 1;

  const props = extractErrorProperties(err);

  assert.deepEqual(props, { ownField: 1 });
});

test("returns an empty object for non-object input", () => {
  assert.deepEqual(extractErrorProperties(null), {});
  assert.deepEqual(extractErrorProperties(undefined), {});
  assert.deepEqual(extractErrorProperties("nope"), {});
  assert.deepEqual(extractErrorProperties(42), {});
});

test("returns a fresh object every call", () => {
  const err = new Error("x");
  err.tag = "a";

  const first = extractErrorProperties(err);
  const second = extractErrorProperties(err);

  assert.notEqual(first, second);
  first.tag = "mutated";
  assert.equal(second.tag, "a");
  assert.equal(err.tag, "a");
});

test("does not include non-enumerable own properties", () => {
  const err = new Error("x");
  Object.defineProperty(err, "hidden", {
    value: 1,
    enumerable: false,
  });
  err.visible = 2;

  const props = extractErrorProperties(err);

  assert.deepEqual(props, { visible: 2 });
});

test("isPlainObject distinguishes plain objects from arrays and class instances", () => {
  assert.equal(isPlainObject({}), true);
  assert.equal(isPlainObject(Object.create(null)), true);
  assert.equal(isPlainObject([]), false);
  assert.equal(isPlainObject(new Error("x")), false);
  assert.equal(isPlainObject(null), false);
});

test("safeStringify serialises bigint values", () => {
  const out = safeStringify({ n: 10n });
  assert.equal(out, '{"n":"10"}');
});

test("safeStringify replaces circular references", () => {
  const value = { a: 1 };
  value.self = value;

  const out = safeStringify(value);
  assert.equal(out, '{"a":1,"self":"[Circular]"}');
});

test("safeStringify handles an Error plus extracted properties", () => {
  const err = new HttpError("boom", 500);
  const payload = {
    message: err.message,
    ...extractErrorProperties(err),
  };

  assert.equal(
    safeStringify(payload),
    '{"message":"boom","statusCode":500,"retryable":true}',
  );
});

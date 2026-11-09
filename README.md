# error-property-extractor

Pulls the non-standard enumerable properties off an `Error` so they survive structured logging.

```js
import { extractErrorProperties, safeStringify } from "error-property-extractor";

class HttpError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.retryable = statusCode >= 500;
  }
}

const err = new HttpError("upstream timed out", 503);

// JSON.stringify(err) would emit just the standard fields, losing statusCode
// and retryable. Spread the extracted properties into the log payload instead.
const payload = { message: err.message, ...extractErrorProperties(err) };

console.log(safeStringify(payload));
// {"message":"upstream timed out","statusCode":503,"retryable":true}
```

## Why this exists

`JSON.stringify` on an `Error` emits only its standard enumerable own
properties, and in most engines that is nothing at all. Custom fields assigned
onto the instance (`statusCode`, `retryable`, `requestId`, ...) are enumerable
own properties, so they are recoverable with `Object.keys` — but they are
silently dropped by the default serializer. This library recovers them.

The trade-off: we only look at **enumerable own** properties. Non-enumerable
fields and fields defined on a subclass prototype are skipped on purpose,
because prototype fields are shared state and copying them into every log
record would be misleading. If you need a prototype field in your logs, assign
it on the instance.

## The awkward edge

The extractor returns a plain object, not an `Error`. It also uses
`Object.create(null)` internally, so a property literally named `__proto__`
will not poison anything — but if you spread the result into another object,
the usual spread semantics apply. Standard fields (`name`, `message`, `stack`,
`cause`) are always excluded so callers can decide where they go in the payload.

## API

- `extractErrorProperties(error)` → `Record<string, unknown>`. Returns a fresh
  object each call; empty when there is nothing to extract.
- `isPlainObject(value)` → `boolean`. True for plain objects and
  `Object.create(null)` objects, false for arrays and class instances.
- `safeStringify(value)` → `string`. JSON serialisation that replaces circular
  references with `"[Circular]"` and stringifies `BigInt` values instead of
  throwing.

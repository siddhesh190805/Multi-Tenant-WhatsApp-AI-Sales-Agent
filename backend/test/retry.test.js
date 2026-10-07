const test = require("node:test");
const assert = require("node:assert/strict");
const { withExponentialBackoff } = require("../src/services/retry");

test("retries transient network failures up to the configured attempt count", async () => {
  let calls = 0;
  const result = await withExponentialBackoff(async () => {
    calls += 1;
    if (calls < 3) {
      const error = new TypeError("fetch failed");
      error.retryable = true;
      throw error;
    }
    return "ok";
  }, { attempts: 3, baseDelayMs: 1 });

  assert.equal(result, "ok");
  assert.equal(calls, 3);
});

test("does not retry permanent failures", async () => {
  let calls = 0;
  await assert.rejects(
    () => withExponentialBackoff(async () => {
      calls += 1;
      throw new Error("bad request");
    }, { attempts: 3, baseDelayMs: 1 }),
    /bad request/,
  );
  assert.equal(calls, 1);
});

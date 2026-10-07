const crypto = require("node:crypto");
const { createRedisConnection } = require("./connection");

const redis = createRedisConnection();
const LOCK_TTL_MS = 120_000;
const WAIT_MS = 50;
const MAX_WAIT_MS = 110_000;

async function acquireLeadLock(leadId) {
  const token = crypto.randomUUID();
  const key = `wa-agent:lead-lock:${leadId}`;
  const deadline = Date.now() + MAX_WAIT_MS;

  while (Date.now() < deadline) {
    const acquired = await redis.set(key, token, "NX", "PX", LOCK_TTL_MS);
    if (acquired === "OK") return { key, token };
    await new Promise((resolve) => setTimeout(resolve, WAIT_MS));
  }

  const error = new Error(`Timed out waiting for lead lock: ${leadId}`);
  error.retryable = true;
  throw error;
}

async function releaseLeadLock(lock) {
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    end
    return 0
  `;

  await redis.eval(script, 1, lock.key, lock.token);
}

module.exports = { acquireLeadLock, releaseLeadLock };

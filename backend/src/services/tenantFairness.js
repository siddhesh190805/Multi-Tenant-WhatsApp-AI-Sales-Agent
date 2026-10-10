const { createRedisConnection } = require("../queue/connection");

const redis = createRedisConnection();
const LIMIT = Number(process.env.TENANT_CONCURRENCY || 5);

async function acquireTenantSlot(accountId) {
  const key = "tenant:slots:" + accountId;
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const value = await redis.incr(key);
    if (value === 1) await redis.expire(key, 60);
    if (value <= LIMIT) return { key };
    await redis.decr(key);
    await new Promise((resolve) => setTimeout(resolve, 50 + Math.floor(Math.random() * 50)));
  }
  throw new Error("Tenant concurrency limit reached");
}
async function releaseTenantSlot(slot) { if (slot) await redis.decr(slot.key).catch(() => {}); }
module.exports = { acquireTenantSlot, releaseTenantSlot };

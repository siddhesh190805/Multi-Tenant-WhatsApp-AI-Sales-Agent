const express = require("express");
const Tenant = require("../models/Tenant");
const Lead = require("../models/Lead");
const Message = require("../models/Message");
const { enqueueMessage } = require("../queue/queue");
const { getEnv } = require("../config/env");
const { verifyWhatsAppSignature } = require("../middlewares/webhookSignature.middleware");

const { createRedisConnection } = require("../queue/connection");
const redis = createRedisConnection();

const router = express.Router();
const TENANT_CACHE_TTL_MS = 30_000;
const tenantCache = new Map();

async function findTenantByPhoneNumberId(phoneNumberId) {
  const now = Date.now();
  const cached = tenantCache.get(phoneNumberId);
  if (cached && cached.expiresAt > now && cached.tenant) return cached.tenant;
  if (cached?.promise) return cached.promise;
  const promise = Tenant.findOne({ phoneNumberId }).lean()
    .then((tenant) => { tenantCache.set(phoneNumberId, { tenant, expiresAt: Date.now() + TENANT_CACHE_TTL_MS }); return tenant; })
    .catch((error) => { tenantCache.delete(phoneNumberId); throw error; });
  tenantCache.set(phoneNumberId, { promise, expiresAt: now + TENANT_CACHE_TTL_MS });
  return promise;
}

router.get("/whatsapp", (req, res) => {
  const env = getEnv();
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && env.webhookVerifyToken && token === env.webhookVerifyToken && challenge) {
    return res.status(200).type("text/plain").send(challenge);
  }

  return res.status(403).json({ error: "Webhook verification failed" });
});

router.post("/whatsapp", verifyWhatsAppSignature, async (req, res, next) => {
  const receivedAt = new Date();
  try {
    const jobs = [];
    const persistTasks = [];

    for (const entry of req.body?.entry || []) {
      for (const change of entry?.changes || []) {
        const value = change?.value;
        if (!value?.messages) continue;

        const phoneNumberId = value.metadata?.phone_number_id;
        const tenant = await findTenantByPhoneNumberId(phoneNumberId);
        if (!tenant) {
          console.warn(`[WEBHOOK] No tenant found for phone_number_id=${phoneNumberId}`);
          continue;
        }

        for (const message of value.messages) {
          if (message?.type !== "text" || !message.id || !message.from) continue;

          const leadPhone = message.from;
          const leadName = value.contacts?.find((contact) => contact.wa_id === leadPhone)?.profile?.name || value.contacts?.[0]?.profile?.name || leadPhone;
          const isNew = await redis.set(`dedup:${tenant.accountId}:${message.id}`, "1", "NX", "EX", 86400);

          if (!isNew) {
            console.log(`[WEBHOOK IGNORE DUPLICATE] accountId=${tenant.accountId} waMessageId=${message.id}`);
            continue;
          }

          const jobData = {
            accountId: tenant.accountId,
            phoneNumberId,
            leadPhone,
            leadName,
            messageId: message.id,
            text: message.text.body,
            receivedAt: receivedAt.toISOString(),
            debounceMs: getEnv().debounceMs,
          };
          jobs.push(jobData);
          console.log("[WEBHOOK] accountId=" + tenant.accountId + " waMessageId=" + message.id);
        }
      }
    }

    jobs.forEach((job) => enqueueMessage(job).catch((err) => console.error("[ENQUEUE ERROR]", err)));
    const duration = Date.now() - receivedAt.getTime();
    res.set("x-response-time-ms", String(duration));
    return res.status(200).json({ received: true, queued: jobs.length });
  } catch (error) {
    console.error("[WEBHOOK ERROR]", error);
    return next(error);
  }
});
module.exports = router;

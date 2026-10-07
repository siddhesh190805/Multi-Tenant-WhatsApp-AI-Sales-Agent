const express = require("express");
const Tenant = require("../models/Tenant");
const Lead = require("../models/Lead");
const Message = require("../models/Message");
const { enqueueMessage } = require("../queue/queue");
const { getEnv } = require("../config/env");
const { verifyWhatsAppSignature } = require("../middlewares/webhookSignature.middleware");

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

router.post("/whatsapp", verifyWhatsAppSignature, async (req, res, next) => {
  const receivedAt = new Date();
  try {
    const jobs = [];

    for (const entry of req.body?.entry || []) {
      for (const change of entry?.changes || []) {
        const value = change?.value;
        if (!value?.messages) continue;

        const phoneNumberId = value.metadata?.phone_number_id;
        const tenant = await findTenantByPhoneNumberId(phoneNumberId);
        if (!tenant) continue;

        for (const message of value.messages) {
          if (message?.type !== "text" || !message.id || !message.from) continue;

          const leadPhone = message.from;
          const leadName = value.contacts?.find((contact) => contact.wa_id === leadPhone)?.profile?.name || value.contacts?.[0]?.profile?.name || leadPhone;
          const duplicate = await Message.findOne({ accountId: tenant.accountId, waMessageId: message.id }).select("leadId").lean();

          if (duplicate) {
            const existingLead = await Lead.findOne({ _id: duplicate.leadId, accountId: tenant.accountId }).lean();
            if (existingLead) {
              jobs.push({
                accountId: tenant.accountId,
                leadId: String(existingLead._id),
                messageId: message.id,
                phoneNumberId,
                receivedAt: receivedAt.toISOString(),
                debounceMs: getEnv().debounceMs,
              });
            }
            continue;
          }

          const lead = await Lead.findOneAndUpdate(
            { accountId: tenant.accountId, phone: leadPhone },
            {
              $set: { name: leadName, lastMessageAt: receivedAt },
              $inc: { messageSequence: 1 },
              $setOnInsert: { accountId: tenant.accountId, phone: leadPhone, status: "new", humanTakeover: false },
            },
            { upsert: true, new: true, setDefaultsOnInsert: true },
          );

          try {
            await Message.create({
              accountId: tenant.accountId,
              leadId: lead._id,
              waMessageId: message.id,
              direction: "in",
              sender: "lead",
              text: message.text.body,
              sequence: lead.messageSequence,
              createdAt: receivedAt,
            });
          } catch (error) {
            if (error?.code === 11000) {
              jobs.push({
                accountId: tenant.accountId,
                leadId: String(lead._id),
                messageId: message.id,
                phoneNumberId,
                receivedAt: receivedAt.toISOString(),
                debounceMs: getEnv().debounceMs,
              });
              continue;
            }
            throw error;
          }

          jobs.push({
            accountId: tenant.accountId,
            leadId: String(lead._id),
            messageId: message.id,
            phoneNumberId,
            receivedAt: receivedAt.toISOString(),
            debounceMs: getEnv().debounceMs,
          });
          console.log("[WEBHOOK] accountId=" + tenant.accountId + " leadId=" + lead._id + " waMessageId=" + message.id);
        }
      }
    }

    await Promise.all(jobs.map((job) => enqueueMessage(job)));
    return res.status(200).json({ received: true, queued: jobs.length });
  } catch (error) {
    console.error("[WEBHOOK ERROR]", error);
    return next(error);
  }
});
module.exports = router;

const express = require("express");
const Tenant = require("../models/Tenant");
const Lead = require("../models/Lead");
const Message = require("../models/Message");
const { enqueueMessage } = require("../queue/queue");

const router = express.Router();

const TENANT_CACHE_TTL_MS = 30_000;
const tenantCache = new Map();

async function findTenantByPhoneNumberId(phoneNumberId) {
  const now = Date.now();
  const cached = tenantCache.get(phoneNumberId);
  if (cached && cached.expiresAt > now && cached.tenant) return cached.tenant;
  if (cached?.promise) return cached.promise;

  const promise = Tenant.findOne({ phoneNumberId }).lean()
    .then((tenant) => {
      tenantCache.set(phoneNumberId, {
        tenant,
        expiresAt: Date.now() + TENANT_CACHE_TTL_MS,
      });
      return tenant;
    })
    .catch((error) => {
      tenantCache.delete(phoneNumberId);
      throw error;
    });

  tenantCache.set(phoneNumberId, { promise, expiresAt: now + TENANT_CACHE_TTL_MS });
  return promise;
}

router.post("/whatsapp", async (req, res, next) => {
  const receivedAt = new Date();

  try {
    const value = req.body?.entry?.[0]?.changes?.[0]?.value;
    const message = value?.messages?.[0];

    if (!value || !message || message.type !== "text") {
      return res.status(200).json({ received: true });
    }

    const phoneNumberId = value.metadata?.phone_number_id;
    const tenant = await findTenantByPhoneNumberId(phoneNumberId);

    if (!tenant) {
      console.warn(`[WEBHOOK UNKNOWN TENANT] phoneNumberId=${phoneNumberId}`);
      return res.status(200).json({ received: true });
    }

    const leadPhone = message.from;
    const leadName = value.contacts?.[0]?.profile?.name || leadPhone;

    const duplicate = await Message.findOne({
      accountId: tenant.accountId,
      waMessageId: message.id,
    }).select("_id").lean();

    if (duplicate) {
      return res.status(200).json({ received: true, duplicate: true });
    }

    const lead = await Lead.findOneAndUpdate(
      { accountId: tenant.accountId, phone: leadPhone },
      {
        $set: { name: leadName, lastMessageAt: receivedAt },
        $inc: { messageSequence: 1 },
        $setOnInsert: {
          accountId: tenant.accountId,
          phone: leadPhone,
          status: "new",
          humanTakeover: false,
        },
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
        return res.status(200).json({ received: true, duplicate: true });
      }
      throw error;
    }

    const jobData = {
      accountId: tenant.accountId,
      leadId: String(lead._id),
      messageId: message.id,
      phoneNumberId,
      receivedAt: receivedAt.toISOString(),
    };

    // Acknowledge immediately after durable persistence; queue delivery continues asynchronously.
    res.status(200).json({ received: true });

    enqueueMessage(jobData).catch((error) => {
      console.error(
        `[WEBHOOK QUEUE ERROR] accountId=${tenant.accountId} leadId=${lead._id} waMessageId=${message.id}`,
        error,
      );
    });

    console.log(
      `[WEBHOOK] accountId=${tenant.accountId} leadId=${lead._id} waMessageId=${message.id}`,
    );
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

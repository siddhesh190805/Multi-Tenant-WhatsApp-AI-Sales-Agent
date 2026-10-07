const express = require("express");
const Tenant = require("../models/Tenant");
const Lead = require("../models/Lead");
const Message = require("../models/Message");
const { enqueueMessage } = require("../queue/queue");

const router = express.Router();

router.post("/whatsapp", async (req, res, next) => {
  const receivedAt = new Date();

  try {
    const value = req.body?.entry?.[0]?.changes?.[0]?.value;
    const message = value?.messages?.[0];

    if (!value || !message || message.type !== "text") {
      return res.status(200).json({ received: true });
    }

    const phoneNumberId = value.metadata?.phone_number_id;
    const tenant = await Tenant.findOne({ phoneNumberId }).lean();

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

    await enqueueMessage({
      accountId: tenant.accountId,
      leadId: String(lead._id),
      messageId: message.id,
      phoneNumberId,
      receivedAt: receivedAt.toISOString(),
    });

    console.log(
      `[WEBHOOK] accountId=${tenant.accountId} leadId=${lead._id} waMessageId=${message.id}`,
    );

    return res.status(200).json({ received: true });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

const express = require("express");
const crypto = require("node:crypto");
const Tenant = require("../models/Tenant");
const { requireAuth } = require("../middlewares/auth.middleware");

const router = express.Router();
router.use(requireAuth);

function makePayload({ phoneNumberId, leadPhone, leadName, text, msgId }) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "WABA_ID",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { phone_number_id: phoneNumberId },
              contacts: [{ profile: { name: leadName }, wa_id: leadPhone }],
              messages: [
                {
                  from: leadPhone,
                  id: msgId,
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  type: "text",
                  text: { body: text },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

router.post("/simulate-message", async (req, res, next) => {
  try {
    if (process.env.NODE_ENV === "production") {
      return res.status(404).end();
    }

    const tenant = await Tenant.findOne({ accountId: req.accountId }).lean();
    if (!tenant) return res.status(404).json({ error: "Tenant not found" });

    const { leadPhone, leadName, text } = req.body || {};
    if (!leadPhone || !leadName || !text) {
      return res.status(400).json({ error: "leadPhone, leadName and text are required" });
    }

    const payload = makePayload({
      phoneNumberId: tenant.phoneNumberId,
      leadPhone,
      leadName,
      text,
      msgId: `wamid.dev.${crypto.randomUUID()}`,
    });

    const response = await fetch(
      `http://127.0.0.1:${process.env.PORT || 4000}/webhook/whatsapp`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    );

    return res.status(202).json({ accepted: response.ok });
  } catch (error) {
    return next(error);
  }
});

module.exports = { router, makePayload };

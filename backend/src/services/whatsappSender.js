const SentMessage = require("../models/SentMessage");
const { getEnv } = require("../config/env");

async function sendWhatsAppMessage({ accountId, phoneNumberId, to, text, replyToWaMessageId }) {
  if (getEnv().whatsappMode !== "mock") {
    throw new Error("Real WhatsApp sending is not implemented for this assessment");
  }

  await SentMessage.create({
    accountId,
    phoneNumberId,
    to,
    text,
    replyToWaMessageId,
  });

  console.log(
    `[MOCK SEND] accountId=${accountId} phoneNumberId=${phoneNumberId} to=${to}: ${text}`,
  );
}

module.exports = { sendWhatsAppMessage };

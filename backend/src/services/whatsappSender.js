const SentMessage = require("../models/SentMessage");
const { getEnv } = require("../config/env");

async function sendWhatsAppMessage({ accountId, phoneNumberId, to, text, replyToWaMessageId }) {
  const env = getEnv();

  if (env.whatsappMode === "mock") {
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
    return { mock: true };
  }

  if (!env.whatsappAccessToken) {
    throw new Error("WHATSAPP_ACCESS_TOKEN is required when WHATSAPP_MODE=real");
  }

  const url = `${env.whatsappGraphBaseUrl}/${env.whatsappGraphVersion}/${encodeURIComponent(phoneNumberId)}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: { body: text, preview_url: false },
  };

  if (replyToWaMessageId) {
    payload.context = { message_id: replyToWaMessageId };
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.whatsappAccessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const raw = await response.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = { raw };
  }

  if (!response.ok) {
    const error = new Error(`WhatsApp Cloud API returned ${response.status}`);
    error.retryable = response.status === 429 || response.status >= 500;
    error.status = response.status;
    error.details = data;
    throw error;
  }

  await SentMessage.create({
    accountId,
    phoneNumberId,
    to,
    text,
    replyToWaMessageId,
    sentAt: new Date(),
  });

  return { mock: false, messageId: data?.messages?.[0]?.id || null };
}

module.exports = { sendWhatsAppMessage };

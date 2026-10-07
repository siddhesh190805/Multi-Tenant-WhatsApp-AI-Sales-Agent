const { Worker } = require("bullmq");
const Lead = require("../models/Lead");
const Tenant = require("../models/Tenant");
const Message = require("../models/Message");
const { createRedisConnection } = require("./connection");
const { MESSAGE_QUEUE_NAME } = require("./queue");
const { acquireLeadLock, releaseLeadLock } = require("./leadLock");
const { generateReply } = require("../services/aiClient");
const { withExponentialBackoff } = require("../services/retry");
const { sendWhatsAppMessage } = require("../services/whatsappSender");

function buildAgentPayload({ tenant, messages }) {
  return {
    tenant: {
      businessName: tenant.businessName,
      tone: tenant.tone,
      language: tenant.language,
      pricing: tenant.pricing,
      faqs: tenant.faqs,
    },
    messages: messages.map((message) => ({
      direction: message.direction,
      sender: message.sender,
      text: message.text,
    })),
  };
}

async function processMessage(job) {
  const { accountId, leadId, messageId, phoneNumberId, receivedAt } = job.data;
  const lock = await acquireLeadLock(leadId);

  try {
    const lead = await Lead.findOne({ _id: leadId, accountId });
    if (!lead) return;

    if (lead.humanTakeover) {
      console.log(`[AI SKIP] accountId=${accountId} leadId=${leadId} waMessageId=${messageId} humanTakeover=true`);
      return;
    }

    const tenant = await Tenant.findOne({ accountId });
    if (!tenant) throw new Error(`Tenant not found: ${accountId}`);

    const messages = await Message.find({ accountId, leadId })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    messages.reverse();

    const startedAt = Date.now();
    let result;
    try {
      result = await withExponentialBackoff(
        () => generateReply(buildAgentPayload({ tenant, messages })),
        { attempts: 3 },
      );
    } catch (error) {
      const fallback =
        "Thanks for your message! Our team will get back to you shortly.";

      const latencyMs = Date.now() - new Date(receivedAt).getTime();
      await Message.create({
        accountId,
        leadId,
        waMessageId: `fallback:${messageId}`,
        direction: "out",
        sender: "fallback",
        text: fallback,
        latencyMs,
      });

      await sendWhatsAppMessage({
        accountId,
        phoneNumberId,
        to: lead.phone,
        text: fallback,
        replyToWaMessageId: messageId,
      });

      console.error(
        `[AI FALLBACK] accountId=${accountId} leadId=${leadId} waMessageId=${messageId} latencyMs=${latencyMs}`,
        error,
      );
      return;
    }

    const text = String(result.response || "").trim();
    if (!text) throw new Error("AI service returned an empty response");

    const latencyMs = Date.now() - new Date(receivedAt).getTime();

    await Message.create({
      accountId,
      leadId,
      waMessageId: `ai:${messageId}`,
      direction: "out",
      sender: "ai",
      text,
      latencyMs,
    });

    await sendWhatsAppMessage({
      accountId,
      phoneNumberId,
      to: lead.phone,
      text,
      replyToWaMessageId: messageId,
    });

    console.log(
      `[AI REPLY] accountId=${accountId} leadId=${leadId} waMessageId=${messageId} latencyMs=${latencyMs} generationMs=${Date.now() - startedAt}`,
    );
  } finally {
    await releaseLeadLock(lock);
  }
}

function createWorker() {
  return new Worker(MESSAGE_QUEUE_NAME, processMessage, {
    connection: createRedisConnection(),
    concurrency: 20,
  });
}

module.exports = { createWorker, processMessage };

const { Worker } = require("bullmq");
const Lead = require("../models/Lead");
const Tenant = require("../models/Tenant");
const Message = require("../models/Message");
const { createRedisConnection } = require("./connection");
const { MESSAGE_QUEUE_NAME, deadLetterQueue } = require("./queue");
const { acquireLeadLock, releaseLeadLock } = require("./leadLock");
const { acquireTenantSlot, releaseTenantSlot } = require("../services/tenantFairness");
const { generateReply } = require("../services/aiClient");
const { withExponentialBackoff } = require("../services/retry");
const { sendWhatsAppMessage } = require("../services/whatsappSender");
const { publishEvent } = require("../services/eventBus");
const { getEnv } = require("../config/env");

function buildAgentPayload({ tenant, messages }) {
  return { tenant: { businessName: tenant.businessName, tone: tenant.tone, language: tenant.language, pricing: tenant.pricing, faqs: tenant.faqs }, messages: messages.map((message) => ({ direction: message.direction, sender: message.sender, text: message.text })) };
}
async function processMessage(job) {
  const { accountId, leadId, messageId, phoneNumberId, receivedAt } = job.data;
  const lock = await acquireLeadLock(leadId);
  const tenantSlot = await acquireTenantSlot(accountId);
  try {
    const lead = await Lead.findOne({ _id: leadId, accountId });
    if (!lead || lead.humanTakeover) return;
    const currentMessage = await Message.findOne({ accountId, leadId, waMessageId: messageId, direction: "in" }).lean();
    if (!currentMessage) throw new Error("Inbound message not found: " + messageId);
    if (getEnv().debounceEnabled) {
      await new Promise((resolve) => setTimeout(resolve, getEnv().debounceMs));
      const latestInbound = await Message.findOne({ accountId, leadId, direction: "in" }).sort({ sequence: -1 }).lean();
      if (latestInbound && latestInbound.sequence > currentMessage.sequence) return;
    }
    const tenant = await Tenant.findOne({ accountId });
    if (!tenant) throw new Error("Tenant not found: " + accountId);
    const messages = await Message.find({ accountId, leadId, sequence: { $lte: currentMessage.sequence } }).sort({ sequence: -1, createdAt: -1 }).limit(10).lean();
    messages.reverse();
    const startedAt = Date.now();
    let result;
    try {
      result = await withExponentialBackoff(() => generateReply(buildAgentPayload({ tenant, messages })), { attempts: 3 });
    } catch (error) {
      const fallback = "Thanks for your message! A team member will take over shortly.";
      await Lead.updateOne({ _id: lead._id, accountId }, { $set: { humanTakeover: true } });
      const latencyMs = Date.now() - new Date(receivedAt).getTime();
      await Message.create({ accountId, leadId, waMessageId: "fallback:" + messageId, direction: "out", sender: "fallback", text: fallback, sequence: currentMessage.sequence, latencyMs });
      await sendWhatsAppMessage({ accountId, phoneNumberId, to: lead.phone, text: fallback, replyToWaMessageId: messageId });
      await publishEvent({ accountId, type: "message:new", payload: { leadId, messageId: "fallback:" + messageId } });
      console.error("[AI AUTO-HANDOFF] accountId=" + accountId + " leadId=" + leadId + " waMessageId=" + messageId, error);
      return;
    }
    const text = String(result.response || "").trim();
    if (!text) throw new Error("AI service returned an empty response");
    const latencyMs = Date.now() - new Date(receivedAt).getTime();
    await Message.create({ accountId, leadId, waMessageId: "ai:" + messageId, direction: "out", sender: "ai", text, sequence: currentMessage.sequence, latencyMs, tokenUsage: result.tokenUsage || undefined });
    await sendWhatsAppMessage({ accountId, phoneNumberId, to: lead.phone, text, replyToWaMessageId: messageId });
    await publishEvent({ accountId, type: "message:new", payload: { leadId, messageId: "ai:" + messageId } });
    console.log("[AI REPLY] accountId=" + accountId + " leadId=" + leadId + " waMessageId=" + messageId + " latencyMs=" + latencyMs + " generationMs=" + (Date.now() - startedAt));
  } finally {
    await releaseTenantSlot(tenantSlot);
    await releaseLeadLock(lock);
  }
}
function createWorker() {
  const worker = new Worker(MESSAGE_QUEUE_NAME, processMessage, { connection: createRedisConnection(), concurrency: getEnv().maxWorkerConcurrency });
  worker.on("failed", async (job, error) => {
    if (!job) return;
    try { await deadLetterQueue.add("failed-message", { ...job.data, failedReason: error.message, failedAt: new Date().toISOString() }); console.error("[DLQ] messageId=" + job.data.messageId + " reason=" + error.message); }
    catch (dlqError) { console.error("[DLQ WRITE ERROR]", dlqError); }
  });
  worker.on("error", (error) => console.error("[WORKER ERROR]", error));
  return worker;
}
module.exports = { createWorker, processMessage };

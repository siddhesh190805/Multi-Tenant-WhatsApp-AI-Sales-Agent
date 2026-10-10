const mongoose = require("mongoose");
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
async function waitForPriorReply(accountId, leadId, sequence) {
  const deadline = Date.now() + 10_000;
  const leadObjectId = typeof leadId === "string" ? new mongoose.Types.ObjectId(leadId) : leadId;
  const recentCutoff = new Date(Date.now() - 30_000);
  while (Date.now() < deadline) {
    const pending = await Message.aggregate([
      { $match: { accountId, leadId: leadObjectId, direction: "in", sequence: { $lt: sequence }, createdAt: { $gte: recentCutoff } } },
      { $lookup: { from: "messages", let: { seq: "$sequence" }, pipeline: [{ $match: { accountId, leadId: leadObjectId, direction: "out" } }, { $match: { $expr: { $eq: ["$sequence", "$$seq"] } } }, { $limit: 1 }], as: "replies" } },
      { $match: { replies: { $size: 0 } } },
      { $limit: 1 },
    ]);
    if (pending.length === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

async function processMessage(job) {
  const { accountId, leadId, messageId, phoneNumberId, receivedAt, leadPhone, leadName, text } = job.data;

  // 1. Resolve or ensure Lead exists
  let lead = leadId ? await Lead.findOne({ _id: leadId, accountId }) : null;
  if (!lead && leadPhone) {
    lead = await Lead.findOneAndUpdate(
      { accountId, phone: leadPhone },
      {
        $set: { name: leadName || leadPhone, lastMessageAt: new Date(receivedAt) },
        $inc: { messageSequence: 1 },
        $setOnInsert: { accountId, phone: leadPhone, status: "new", humanTakeover: false },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
  if (!lead) throw new Error("Lead could not be found or created for message " + messageId);

  const actualLeadId = lead._id;

  // 2. Resolve or ensure inbound Message exists
  let currentMessage = await Message.findOne({ accountId, leadId: actualLeadId, waMessageId: messageId, direction: "in" }).lean();
  if (!currentMessage) {
    try {
      currentMessage = await Message.create({
        accountId,
        leadId: actualLeadId,
        waMessageId: messageId,
        direction: "in",
        sender: "lead",
        text: text || "",
        sequence: lead.messageSequence,
        createdAt: new Date(receivedAt),
      });
    } catch (err) {
      if (err?.code === 11000) {
        currentMessage = await Message.findOne({ accountId, leadId: actualLeadId, waMessageId: messageId, direction: "in" }).lean();
      } else {
        throw err;
      }
    }
  }
  if (!currentMessage) throw new Error("Inbound message not found: " + messageId);

  await waitForPriorReply(accountId, actualLeadId, currentMessage.sequence);
  const lock = await acquireLeadLock(actualLeadId);
  const tenantSlot = await acquireTenantSlot(accountId);
  try {
    const leadDoc = await Lead.findOne({ _id: actualLeadId, accountId });
    if (!leadDoc || leadDoc.humanTakeover) return;
    if (getEnv().debounceEnabled) {
      await new Promise((resolve) => setTimeout(resolve, getEnv().debounceMs));
      const latestInbound = await Message.findOne({ accountId, leadId: actualLeadId, direction: "in" }).sort({ sequence: -1 }).lean();
      if (latestInbound && latestInbound.sequence > currentMessage.sequence) return;
    }
    const tenant = await Tenant.findOne({ accountId });
    if (!tenant) throw new Error("Tenant not found: " + accountId);
    const messages = await Message.find({ accountId, leadId: actualLeadId, sequence: { $lte: currentMessage.sequence } }).sort({ sequence: -1, createdAt: -1 }).limit(10).lean();
    messages.reverse();
    const startedAt = Date.now();
    let result;
    let replyText;
    try {
      result = await withExponentialBackoff(() => generateReply(buildAgentPayload({ tenant, messages })), { attempts: 3 });
      replyText = String(result.response || "").trim();
      if (!replyText) throw new Error("AI service returned an empty response");
    } catch (error) {
      const fallback = "Thanks for your message! A team member will take over shortly.";
      await Lead.updateOne({ _id: actualLeadId, accountId }, { $set: { humanTakeover: true } });
      const latencyMs = Date.now() - new Date(receivedAt).getTime();
      await Message.create({ accountId, leadId: actualLeadId, waMessageId: "fallback:" + messageId, direction: "out", sender: "fallback", text: fallback, sequence: currentMessage.sequence, latencyMs });
      await sendWhatsAppMessage({ accountId, phoneNumberId, to: lead.phone, text: fallback, replyToWaMessageId: messageId });
      await publishEvent({ accountId, type: "message:new", payload: { leadId: actualLeadId, messageId: "fallback:" + messageId } });
      console.error("[AI AUTO-HANDOFF] accountId=" + accountId + " leadId=" + actualLeadId + " waMessageId=" + messageId, error);
      return;
    }
    const latestLead = await Lead.findOne({ _id: actualLeadId, accountId }).lean();
    if (!latestLead || latestLead.humanTakeover) return;
    const latencyMs = Date.now() - new Date(receivedAt).getTime();
    await Message.create({ accountId, leadId: actualLeadId, waMessageId: "ai:" + messageId, direction: "out", sender: "ai", text: replyText, sequence: currentMessage.sequence, latencyMs, tokenUsage: result.tokenUsage || undefined });
    await sendWhatsAppMessage({ accountId, phoneNumberId, to: lead.phone, text: replyText, replyToWaMessageId: messageId });
    await publishEvent({ accountId, type: "message:new", payload: { leadId: actualLeadId, messageId: "ai:" + messageId } });
    console.log("[AI REPLY] accountId=" + accountId + " leadId=" + actualLeadId + " waMessageId=" + messageId + " latencyMs=" + latencyMs + " generationMs=" + (Date.now() - startedAt));

    if (Array.isArray(result?.actions) && result.actions.length > 0) {
      for (const action of result.actions) {
        const toolName = action.tool || action.type;
        if (toolName === "handoff_to_human") {
          await Lead.updateOne({ _id: actualLeadId, accountId }, { $set: { humanTakeover: true } });
          await publishEvent({ accountId, type: "lead:updated", payload: { leadId: actualLeadId, humanTakeover: true, reason: action.reason } });
          console.log(`[AI TOOL: HANDOFF] accountId=${accountId} leadId=${actualLeadId} reason=${action.reason || "user_requested"}`);
        } else if (toolName === "update_lead_status" && action.status) {
          await Lead.updateOne({ _id: actualLeadId, accountId }, { $set: { status: action.status } });
          await publishEvent({ accountId, type: "lead:updated", payload: { leadId: actualLeadId, status: action.status } });
          console.log(`[AI TOOL: STATUS] accountId=${accountId} leadId=${actualLeadId} status=${action.status}`);
        } else if (toolName === "book_site_visit") {
          const appointmentStatus = "appointment_scheduled";
          const visitDate = action.preferred_date || action.date || "Tomorrow 11:00 AM";
          await Lead.updateOne(
            { _id: actualLeadId, accountId },
            { $set: { status: appointmentStatus, metadata: { siteVisitDate: visitDate } } }
          );
          await publishEvent({
            accountId,
            type: "lead:updated",
            payload: { leadId: actualLeadId, status: appointmentStatus, siteVisitDate: visitDate },
          });
          console.log(`[AI TOOL: SITE_VISIT] accountId=${accountId} leadId=${actualLeadId} date=${visitDate}`);
        }
      }
    }
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

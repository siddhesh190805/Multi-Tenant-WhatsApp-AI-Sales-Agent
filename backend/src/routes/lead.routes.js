const express = require("express");
const crypto = require("crypto");
const Lead = require("../models/Lead");
const Message = require("../models/Message");
const Tenant = require("../models/Tenant");
const { requireAuth } = require("../middlewares/auth.middleware");
const { sendWhatsAppMessage } = require("../services/whatsappSender");
const { publishEvent } = require("../services/eventBus");
const { acquireLeadLock, releaseLeadLock } = require("../queue/leadLock");

const router = express.Router();
router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    const status = String(req.query.status || "").trim();
    const filter = { accountId: req.accountId };
    if (q) filter.$or = [{ name: new RegExp(q, "i") }, { phone: new RegExp(q, "i") }];
    if (status) filter.status = status;
    const leads = await Lead.find(filter).sort({ lastMessageAt: -1 }).lean();
    const leadIds = leads.map((lead) => lead._id);
    const latestMessages = await Message.aggregate([{ $match: { accountId: req.accountId, leadId: { $in: leadIds } } }, { $sort: { createdAt: -1 } }, { $group: { _id: "$leadId", text: { $first: "$text" }, createdAt: { $first: "$createdAt" } } }]);
    const latestByLead = new Map(latestMessages.map((item) => [String(item._id), item]));
    return res.json({ leads: leads.map((lead) => { const latest = latestByLead.get(String(lead._id)); return { id: String(lead._id), name: lead.name, phone: lead.phone, status: lead.status, humanTakeover: lead.humanTakeover, lastMessageText: latest?.text || null, lastMessageAt: lead.lastMessageAt }; }) });
  } catch (error) { return next(error); }
});

router.get("/:leadId/messages", async (req, res, next) => {
  try {
    const lead = await Lead.findOne({ _id: req.params.leadId, accountId: req.accountId }).lean();
    if (!lead) return res.status(404).json({ error: "Lead not found" });
    const messages = await Message.find({ accountId: req.accountId, leadId: lead._id }).sort({ createdAt: 1 }).lean();
    return res.json({ lead: { id: String(lead._id), name: lead.name, phone: lead.phone, humanTakeover: lead.humanTakeover }, messages: messages.map((message) => ({ id: String(message._id), direction: message.direction, sender: message.sender, text: message.text, latencyMs: message.latencyMs, tokenUsage: message.tokenUsage, createdAt: message.createdAt })) });
  } catch (error) { return next(error); }
});

router.patch("/:leadId/takeover", async (req, res, next) => {
  try {
    if (typeof req.body?.enabled !== "boolean") return res.status(400).json({ error: "enabled must be a boolean" });
    const enabled = req.body.enabled;
    const lock = await acquireLeadLock(req.params.leadId);
    try {
      const lead = await Lead.findOneAndUpdate({ _id: req.params.leadId, accountId: req.accountId }, { $set: { humanTakeover: enabled } }, { new: true }).lean();
      if (!lead) return res.status(404).json({ error: "Lead not found" });
      return res.json({ id: String(lead._id), humanTakeover: lead.humanTakeover });
    } finally {
      await releaseLeadLock(lock);
    }
  } catch (error) { return next(error); }
});

router.post("/:leadId/messages", async (req, res, next) => {
  try {
    const text = String(req.body?.text || "").trim();
    if (!text) return res.status(400).json({ error: "Message text is required" });
    const lead = await Lead.findOne({ _id: req.params.leadId, accountId: req.accountId });
    if (!lead) return res.status(404).json({ error: "Lead not found" });
    const sequence = (lead.messageSequence || 0) + 1;
    lead.messageSequence = sequence; lead.lastMessageAt = new Date(); await lead.save();
    const messageId = "human:" + crypto.randomUUID();
    await Message.create({ accountId: req.accountId, leadId: lead._id, waMessageId: messageId, direction: "out", sender: "human", text, sequence });
    const tenant = await Tenant.findOne({ accountId: req.accountId }).lean();
    await sendWhatsAppMessage({ accountId: req.accountId, phoneNumberId: tenant.phoneNumberId, to: lead.phone, text, replyToWaMessageId: null });
    await publishEvent({ accountId: req.accountId, type: "message:new", payload: { leadId: String(lead._id), messageId } });
    return res.status(201).json({ ok: true, messageId });
  } catch (error) { return next(error); }
});
module.exports = router;

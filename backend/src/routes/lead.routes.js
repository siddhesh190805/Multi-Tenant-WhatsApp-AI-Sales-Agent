const express = require("express");
const Lead = require("../models/Lead");
const Message = require("../models/Message");
const { requireAuth } = require("../middlewares/auth.middleware");

const router = express.Router();
router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const leads = await Lead.find({ accountId: req.accountId })
      .sort({ lastMessageAt: -1 })
      .lean();

    const leadIds = leads.map((lead) => lead._id);
    const latestMessages = await Message.aggregate([
      { $match: { accountId: req.accountId, leadId: { $in: leadIds } } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$leadId",
          text: { $first: "$text" },
          createdAt: { $first: "$createdAt" },
        },
      },
    ]);

    const latestByLead = new Map(latestMessages.map((item) => [String(item._id), item]));

    return res.json({
      leads: leads.map((lead) => {
        const latest = latestByLead.get(String(lead._id));
        return {
          id: String(lead._id),
          name: lead.name,
          phone: lead.phone,
          status: lead.status,
          humanTakeover: lead.humanTakeover,
          lastMessageText: latest?.text || null,
          lastMessageAt: lead.lastMessageAt,
        };
      }),
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/:leadId/messages", async (req, res, next) => {
  try {
    const lead = await Lead.findOne({
      _id: req.params.leadId,
      accountId: req.accountId,
    }).lean();

    if (!lead) return res.status(404).json({ error: "Lead not found" });

    const messages = await Message.find({
      accountId: req.accountId,
      leadId: lead._id,
    })
      .sort({ createdAt: 1 })
      .lean();

    return res.json({
      lead: {
        id: String(lead._id),
        name: lead.name,
        phone: lead.phone,
        humanTakeover: lead.humanTakeover,
      },
      messages: messages.map((message) => ({
        id: String(message._id),
        direction: message.direction,
        sender: message.sender,
        text: message.text,
        latencyMs: message.latencyMs,
        createdAt: message.createdAt,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

router.patch("/:leadId/takeover", async (req, res, next) => {
  try {
    const enabled = Boolean(req.body?.enabled);
    const lead = await Lead.findOneAndUpdate(
      { _id: req.params.leadId, accountId: req.accountId },
      { $set: { humanTakeover: enabled } },
      { new: true },
    ).lean();

    if (!lead) return res.status(404).json({ error: "Lead not found" });

    return res.json({
      id: String(lead._id),
      humanTakeover: lead.humanTakeover,
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

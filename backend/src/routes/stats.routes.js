const express = require("express");
const Lead = require("../models/Lead");
const Message = require("../models/Message");
const { requireAuth } = require("../middlewares/auth.middleware");

const router = express.Router();
router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const accountId = req.accountId;
    const [leads, messages, aiMessages, humanMessages, avg] = await Promise.all([
      Lead.countDocuments({ accountId }),
      Message.countDocuments({ accountId }),
      Message.countDocuments({ accountId, direction: "out", sender: "ai" }),
      Message.countDocuments({ accountId, direction: "out", sender: "human" }),
      Message.aggregate([
        { $match: { accountId, direction: "out", sender: "ai", latencyMs: { $ne: null } } },
        { $group: { _id: null, value: { $avg: "$latencyMs" } } },
      ]),
    ]);
    const tokenAgg = await Message.aggregate([
      { $match: { accountId, direction: "out", sender: "ai", "tokenUsage.total": { $ne: null } } },
      { $group: { _id: null, input: { $sum: "$tokenUsage.input" }, output: { $sum: "$tokenUsage.output" }, total: { $sum: "$tokenUsage.total" } } },
    ]);
    return res.json({
      leads, messages, aiMessages, humanMessages,
      avgAiLatencyMs: Math.round(avg[0]?.value || 0),
      tokens: tokenAgg[0] || { input: 0, output: 0, total: 0 },
    });
  } catch (error) { return next(error); }
});

module.exports = { router };

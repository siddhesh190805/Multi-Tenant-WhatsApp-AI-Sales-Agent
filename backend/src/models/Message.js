const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    accountId: { type: String, required: true, index: true },
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", required: true, index: true },
    waMessageId: { type: String, required: true, unique: true, index: true },
    direction: { type: String, enum: ["in", "out"], required: true },
    sender: { type: String, enum: ["lead", "ai", "fallback", "human"], required: true },
    text: { type: String, required: true },
    sequence: { type: Number, default: 0, index: true },
    latencyMs: { type: Number, default: null },
    createdAt: { type: Date, default: Date.now, index: true },
  },
);

messageSchema.index({ accountId: 1, leadId: 1, createdAt: 1 });

module.exports = mongoose.model("Message", messageSchema);

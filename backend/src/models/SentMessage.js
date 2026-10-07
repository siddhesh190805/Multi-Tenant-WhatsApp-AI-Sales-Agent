const mongoose = require("mongoose");

const sentMessageSchema = new mongoose.Schema(
  {
    accountId: { type: String, required: true, index: true },
    phoneNumberId: { type: String, required: true },
    to: { type: String, required: true },
    text: { type: String, required: true },
    replyToWaMessageId: { type: String, required: true, index: true },
    sentAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

module.exports = mongoose.model("SentMessage", sentMessageSchema);

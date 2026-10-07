const mongoose = require("mongoose");

const leadSchema = new mongoose.Schema(
  {
    accountId: { type: String, required: true, index: true },
    phone: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    status: { type: String, default: "new" },
    humanTakeover: { type: Boolean, default: false },
    messageSequence: { type: Number, default: 0 },
    lastMessageAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);

leadSchema.index({ accountId: 1, phone: 1 }, { unique: true });

module.exports = mongoose.model("Lead", leadSchema);

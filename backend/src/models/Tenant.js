const mongoose = require("mongoose");

const faqSchema = new mongoose.Schema(
  {
    q: { type: String, required: true, trim: true },
    a: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const tenantSchema = new mongoose.Schema(
  {
    accountId: { type: String, required: true, unique: true, index: true },
    businessName: { type: String, required: true, trim: true },
    phoneNumberId: { type: String, required: true, unique: true, index: true },
    tone: { type: String, required: true },
    language: { type: String, required: true },
    faqs: { type: [faqSchema], default: [] },
    pricing: { type: String, required: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Tenant", tenantSchema);

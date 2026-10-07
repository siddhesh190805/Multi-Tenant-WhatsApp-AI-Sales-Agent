const Lead = require("../models/Lead");

async function findOrCreate({ accountId, phone, name }) {
  return Lead.findOneAndUpdate(
    { accountId, phone },
    {
      $set: { name, lastMessageAt: new Date() },
      $setOnInsert: { accountId, phone, status: "new", humanTakeover: false },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

async function touch(leadId, accountId) {
  return Lead.findOneAndUpdate(
    { _id: leadId, accountId },
    { $set: { lastMessageAt: new Date() } },
    { new: true },
  );
}

module.exports = { findOrCreate, touch };

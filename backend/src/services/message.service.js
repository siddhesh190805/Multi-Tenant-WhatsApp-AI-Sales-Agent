const Message = require("../models/Message");

async function createIncoming(data) {
  return Message.create({
    ...data,
    direction: "in",
    sender: "lead",
  });
}

async function listForLead(accountId, leadId) {
  return Message.find({ accountId, leadId }).sort({ createdAt: 1 }).lean();
}

async function createOutgoing(data) {
  return Message.create({
    ...data,
    direction: "out",
  });
}

module.exports = { createIncoming, listForLead, createOutgoing };

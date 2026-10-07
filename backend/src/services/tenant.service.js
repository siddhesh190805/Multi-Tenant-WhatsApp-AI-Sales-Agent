const Tenant = require("../models/Tenant");

async function findByPhoneNumberId(phoneNumberId) {
  return Tenant.findOne({ phoneNumberId });
}

async function findByAccountId(accountId) {
  return Tenant.findOne({ accountId });
}

module.exports = { findByPhoneNumberId, findByAccountId };

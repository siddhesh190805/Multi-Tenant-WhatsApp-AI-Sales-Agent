require("dotenv").config();

const bcrypt = require("bcrypt");
const { connectDatabase, disconnectDatabase } = require("../src/config/database");
const Tenant = require("../src/models/Tenant");
const User = require("../src/models/User");

/**
 * Script to add a 3rd tenant on the spot during live walkthrough/interviews
 * Usage: node scripts/add-tenant.js
 */
async function addThirdTenant() {
  await connectDatabase();

  const newTenant = {
    accountId: "acc_C",
    businessName: "DentCare Clinic",
    phoneNumberId: "PHONE_TENANT_C",
    tone: "caring, gentle, and informative",
    language: "Reply in the same language the customer uses (English, Hindi or Hinglish)",
    pricing: "Consultation is Rs 500. Teeth cleaning is Rs 1,500. Root canal starts at Rs 4,500.",
    faqs: [
      { q: "What are the clinic timings?", a: "Monday to Saturday from 9 AM to 8 PM." },
      { q: "Do you accept insurance?", a: "Yes, we accept all major health and dental insurance plans." },
      { q: "Is root canal painful?", a: "No, we use modern painless local anesthesia." },
    ],
    owner: {
      name: "DentCare Owner",
      email: "owner@dentcare.test",
      password: "DentCare@123",
    },
  };

  await Tenant.findOneAndUpdate(
    { accountId: newTenant.accountId },
    {
      $set: {
        businessName: newTenant.businessName,
        phoneNumberId: newTenant.phoneNumberId,
        tone: newTenant.tone,
        language: newTenant.language,
        pricing: newTenant.pricing,
        faqs: newTenant.faqs,
      },
      $setOnInsert: { accountId: newTenant.accountId },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const passwordHash = await bcrypt.hash(newTenant.owner.password, 12);

  await User.findOneAndUpdate(
    { email: newTenant.owner.email.toLowerCase() },
    {
      $set: {
        accountId: newTenant.accountId,
        passwordHash,
        name: newTenant.owner.name,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  console.log("==================================================");
  console.log("Successfully created 3rd Tenant: DentCare Clinic!");
  console.log("Account ID     : acc_C");
  console.log("Phone Number ID: PHONE_TENANT_C");
  console.log("Dashboard Login:");
  console.log("  Email   : owner@dentcare.test");
  console.log("  Password: DentCare@123");
  console.log("==================================================");

  await disconnectDatabase();
}

addThirdTenant().catch(async (err) => {
  console.error("Error creating tenant:", err);
  await disconnectDatabase();
  process.exit(1);
});

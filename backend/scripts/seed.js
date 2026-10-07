require("dotenv").config();

const bcrypt = require("bcrypt");
const { connectDatabase, disconnectDatabase } = require("../src/config/database");
const Tenant = require("../src/models/Tenant");
const User = require("../src/models/User");

const tenants = [
  {
    accountId: "acc_A",
    businessName: "Sunrise Realty",
    phoneNumberId: "PHONE_TENANT_A",
    tone: "professional and polite",
    language: "Reply in the same language the customer uses (English, Hindi or Hinglish)",
    pricing:
      "2BHK flats start at Rs 45 lakh. 3BHK flats start at Rs 68 lakh. Booking amount is Rs 1 lakh.",
    faqs: [
      { q: "Where is the project?", a: "Sector 62, Noida, near the metro station." },
      { q: "Is a site visit possible?", a: "Yes, site visits run daily from 10 AM to 6 PM." },
      { q: "Is a home loan available?", a: "Yes, we have tie-ups with SBI, HDFC and ICICI." },
    ],
    owner: {
      name: "Sunrise Owner",
      email: "owner@sunrise.test",
      password: "Sunrise@123",
    },
  },
  {
    accountId: "acc_B",
    businessName: "FitZone Gym",
    phoneNumberId: "PHONE_TENANT_B",
    tone: "friendly and energetic",
    language: "Reply in the same language the customer uses (English, Hindi or Hinglish)",
    pricing:
      "Monthly plan Rs 1,500. Quarterly plan Rs 4,000. Yearly plan Rs 12,000. Personal trainer Rs 3,000 per month extra.",
    faqs: [
      { q: "What are the timings?", a: "5 AM to 11 PM, all 7 days." },
      { q: "Is there a free trial?", a: "Yes, one free trial day for new members." },
      { q: "Do you have a steam room?", a: "Yes, steam and shower are included in all plans." },
    ],
    owner: {
      name: "FitZone Owner",
      email: "owner@fitzone.test",
      password: "FitZone@123",
    },
  },
];

async function seed() {
  await connectDatabase();

  for (const data of tenants) {
    await Tenant.findOneAndUpdate(
      { accountId: data.accountId },
      {
        $set: {
          businessName: data.businessName,
          phoneNumberId: data.phoneNumberId,
          tone: data.tone,
          language: data.language,
          pricing: data.pricing,
          faqs: data.faqs,
        },
        $setOnInsert: { accountId: data.accountId },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    const passwordHash = await bcrypt.hash(data.owner.password, 12);

    await User.findOneAndUpdate(
      { email: data.owner.email.toLowerCase() },
      {
        $set: {
          accountId: data.accountId,
          passwordHash,
          name: data.owner.name,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }

  console.log("Seed complete.");
  await disconnectDatabase();
}

seed().catch(async (error) => {
  console.error(error);
  await disconnectDatabase();
  process.exit(1);
});

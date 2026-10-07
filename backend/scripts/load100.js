require("dotenv").config();
const { connectDatabase, disconnectDatabase } = require("../src/config/database");
const Message = require("../src/models/Message");
const Lead = require("../src/models/Lead");
const { makePayload } = require("../src/routes/dev.routes");

const URL = process.env.WEBHOOK_URL || "http://localhost:4000/webhook/whatsapp";
const RUN = Date.now().toString(36);

async function send(payload) {
  const start = Date.now();
  const response = await fetch(URL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
  return { status: response.status, ms: Date.now() - start };
}
async function main() {
  await connectDatabase();
  const requests = [];
  for (let i = 0; i < 100; i += 1) {
    const tenant = i % 2 === 0 ? "A" : "B";
    const accountId = tenant === "A" ? "acc_A" : "acc_B";
    const phoneNumberId = tenant === "A" ? "PHONE_TENANT_A" : "PHONE_TENANT_B";
    const phone = "919900" + RUN.slice(-5) + String(i).padStart(3, "0");
    await Lead.updateOne({ accountId, phone }, { $set: { name: "Load " + i, lastMessageAt: new Date(), humanTakeover: false }, $setOnInsert: { accountId, phone, status: "new" } }, { upsert: true });
    requests.push(send(makePayload({ phoneNumberId, leadPhone: phone, leadName: "Load " + i, text: "Hi, what is the price?", msgId: "wamid.load100." + RUN + "." + i })));
  }
  const responses = await Promise.all(requests);
  const max = Math.max(...responses.map((r) => r.ms));
  const avg = responses.reduce((s, r) => s + r.ms, 0) / responses.length;
  const pattern = new RegExp("^ai:wamid\\.load100\\." + RUN + "\\.");
  const deadline = Date.now() + 90000;
  let replies = 0;
  while (Date.now() < deadline) {
    replies = await Message.countDocuments({ sender: "ai", waMessageId: { $regex: pattern } });
    if (replies >= 100) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  console.log(JSON.stringify({ leads: 100, accepted: responses.filter((r) => r.status === 200).length, replies, maxWebhookMs: max, avgWebhookMs: Number(avg.toFixed(1)) }, null, 2));
  if (responses.some((response) => response.status !== 200) || replies < 100) throw new Error("100-lead load test failed");
  await disconnectDatabase();
}
main().catch(async (e) => { console.error(e); await disconnectDatabase(); process.exit(1); });

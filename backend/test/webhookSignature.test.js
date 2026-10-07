const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { verifyWhatsAppSignature } = require("../src/middlewares/webhookSignature.middleware");

const secret = "test-secret";
const body = Buffer.from(JSON.stringify({ hello: "world" }));
const signature = "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");

test("accepts a valid WhatsApp signature", () => {
  const previous = process.env.WHATSAPP_APP_SECRET;
  process.env.WHATSAPP_APP_SECRET = secret;
  const req = { rawBody: body, get: (name) => name === "x-hub-signature-256" ? signature : "" };
  let nextCalled = false;
  verifyWhatsAppSignature(req, { status: () => ({ json: () => {} }) }, () => { nextCalled = true; });
  process.env.WHATSAPP_APP_SECRET = previous;
  assert.equal(nextCalled, true);
});

test("rejects an invalid WhatsApp signature", () => {
  const previous = process.env.WHATSAPP_APP_SECRET;
  process.env.WHATSAPP_APP_SECRET = secret;
  let statusCode;
  const req = { rawBody: body, get: () => "sha256=invalid" };
  const res = { status: (code) => { statusCode = code; return { json: () => {} }; } };
  verifyWhatsAppSignature(req, res, () => {});
  process.env.WHATSAPP_APP_SECRET = previous;
  assert.equal(statusCode, 401);
});

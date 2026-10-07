const crypto = require("crypto");
const { getEnv } = require("../config/env");

function verifyWhatsAppSignature(req, res, next) {
  const secret = getEnv().webhookSecret;
  if (!secret) return next();
  const signature = req.get("x-hub-signature-256") || "";
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(req.rawBody || Buffer.from(JSON.stringify(req.body))).digest("hex");
  const valid = signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!valid) return res.status(401).json({ error: "Invalid webhook signature" });
  return next();
}
module.exports = { verifyWhatsAppSignature };

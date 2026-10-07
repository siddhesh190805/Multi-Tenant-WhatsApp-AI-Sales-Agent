const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Tenant = require("../models/Tenant");
const { getEnv } = require("../config/env");

async function authenticate(email, password) {
  const user = await User.findOne({ email: email.toLowerCase() }).lean();
  if (!user) return null;

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return null;

  const token = jwt.sign(
    { sub: String(user._id), accountId: user.accountId },
    getEnv().jwtSecret,
    { expiresIn: "8h" },
  );

  const tenant = await Tenant.findOne({ accountId: user.accountId }).lean();

  return {
    token,
    user: {
      id: String(user._id),
      email: user.email,
      name: user.name,
      accountId: user.accountId,
      businessName: tenant?.businessName || null,
    },
  };
}

function verifyToken(token) {
  return jwt.verify(token, getEnv().jwtSecret);
}

module.exports = { authenticate, verifyToken };

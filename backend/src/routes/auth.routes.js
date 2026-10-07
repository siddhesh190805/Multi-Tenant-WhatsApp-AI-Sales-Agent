const express = require("express");
const cookieParser = require("cookie-parser");
const { authenticate } = require("../services/auth.service");
const { requireAuth } = require("../middlewares/auth.middleware");
const User = require("../models/User");
const Tenant = require("../models/Tenant");

const router = express.Router();
router.use(cookieParser());

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "Email and password are required" });

    const result = await authenticate(email, password);
    if (!result) return res.status(401).json({ error: "Invalid email or password" });

    res.cookie("token", result.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 8 * 60 * 60 * 1000,
    });

    return res.json({ user: result.user });
  } catch (error) {
    return next(error);
  }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await User.findOne({ _id: req.user.sub, accountId: req.accountId }).lean();
    const tenant = await Tenant.findOne({ accountId: req.accountId }).lean();
    if (!user || !tenant) return res.status(401).json({ error: "Unauthorized" });

    return res.json({
      user: {
        id: String(user._id),
        email: user.email,
        name: user.name,
        accountId: user.accountId,
        businessName: tenant.businessName,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/logout", (_req, res) => {
  res.clearCookie("token");
  res.status(204).end();
});

module.exports = router;

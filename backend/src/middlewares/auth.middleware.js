const { verifyToken } = require("../services/auth.service");

function requireAuth(req, res, next) {
  try {
    const header = req.get("authorization");
    const cookieToken = req.cookies?.token;
    const token = cookieToken || (header?.startsWith("Bearer ") ? header.slice(7) : null);

    if (!token) return res.status(401).json({ error: "Unauthorized" });

    const payload = verifyToken(token);
    req.user = payload;
    req.accountId = payload.accountId;
    return next();
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

module.exports = { requireAuth };

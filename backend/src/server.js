require("dotenv").config();
const http = require("http");
const jwt = require("jsonwebtoken");
const app = require("./app");
const { Server } = require("socket.io");
const { getEnv } = require("./config/env");
const { connectDatabase, disconnectDatabase } = require("./config/database");
const { subscribeEvents } = require("./services/eventBus");

function socketAccountId(socket) {
  const cookie = socket.request.headers.cookie || "";
  const match = cookie.match(/(?:^|; )token=([^;]+)/);
  const rawToken = match ? decodeURIComponent(match[1]) : (socket.handshake.auth?.token || socket.handshake.query?.token || null);
  if (!rawToken) return null;
  try { return jwt.verify(rawToken, getEnv().jwtSecret).accountId; } catch { return null; }
}
async function start() {
  const env = getEnv();
  await connectDatabase();
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: true, credentials: true } });
  io.use((socket, next) => socketAccountId(socket) ? next() : next(new Error("Unauthorized")));
  io.on("connection", (socket) => { socket.accountId = socketAccountId(socket); socket.emit("connected", { ok: true }); });
  subscribeEvents((event) => { if (event.accountId) io.sockets.sockets.forEach((socket) => { if (socket.accountId === event.accountId) socket.emit(event.type, event.payload); }); });
  server.listen(env.port, () => console.log("HTTP + Socket.IO server listening on port " + env.port));
  const shutdown = async (_signal) => { await new Promise((resolve) => server.close(resolve)); await disconnectDatabase(); process.exit(0); };
  process.once("SIGINT", () => shutdown("SIGINT")); process.once("SIGTERM", () => shutdown("SIGTERM"));
}
start().catch((error) => { console.error("[STARTUP ERROR]", error); process.exit(1); });

const requiredInProduction = ["MONGODB_URI", "REDIS_URL", "JWT_SECRET"];

function getEnv() {
  const env = process.env.NODE_ENV || "development";
  if (env === "production") {
    for (const name of requiredInProduction) {
      if (!process.env[name]) throw new Error("Missing required environment variable: " + name);
    }
  }
  return {
    nodeEnv: env,
    port: Number(process.env.PORT || 4000),
    mongodbUri: process.env.MONGODB_URI || "mongodb://localhost:27017/whatsapp_ai_agent",
    redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
    jwtSecret: process.env.JWT_SECRET || "development-only-change-me",
    aiServiceUrl: process.env.AI_SERVICE_URL || "http://localhost:8000",
    whatsappMode: process.env.WHATSAPP_MODE || "mock",
    llmTimeoutMs: Number(process.env.LLM_TIMEOUT_MS || 20000),
    webhookSecret: process.env.WHATSAPP_APP_SECRET || "",
    debounceMs: Number(process.env.AI_DEBOUNCE_MS || 350),
    debounceEnabled: String(process.env.AI_DEBOUNCE_ENABLED || "false").trim().toLowerCase() === "true",
    maxWorkerConcurrency: Number(process.env.WORKER_CONCURRENCY || 20),
  };
}
module.exports = { getEnv };

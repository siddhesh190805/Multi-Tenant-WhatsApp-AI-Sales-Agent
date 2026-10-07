require("dotenv").config();

const app = require("./app");
const { getEnv } = require("./config/env");
const { connectDatabase } = require("./config/database");
const { createWorker } = require("./queue/worker");

async function start() {
  const env = getEnv();
  await connectDatabase();

  const worker = createWorker();
  worker.on("failed", (job, error) => {
    console.error("[QUEUE FAILED]", {
      jobId: job?.id,
      error: error.message,
    });
  });

  const server = app.listen(env.port, () => {
    console.log(`HTTP server listening on port ${env.port}`);
    console.log("BullMQ worker started");
  });

  const shutdown = async (signal) => {
    console.log(`Received ${signal}, shutting down...`);
    await new Promise((resolve) => server.close(resolve));
    await worker.close();
    process.exit(0);
  };

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
}

start().catch((error) => {
  console.error("[STARTUP ERROR]", error);
  process.exit(1);
});

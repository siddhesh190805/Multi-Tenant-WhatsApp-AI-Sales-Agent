require("dotenv").config();

const { connectDatabase, disconnectDatabase } = require("./config/database");
const { createWorker } = require("./queue/worker");

async function start() {
  await connectDatabase();

  const worker = createWorker();
  worker.on("failed", (job, error) => {
    console.error("[QUEUE FAILED]", {
      jobId: job?.id,
      error: error.message,
    });
  });

  console.log("BullMQ worker started");

  const shutdown = async (signal) => {
    console.log(`Received ${signal}, shutting down worker...`);
    await worker.close();
    await disconnectDatabase();
    process.exit(0);
  };

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
}

start().catch((error) => {
  console.error("[WORKER STARTUP ERROR]", error);
  process.exit(1);
});

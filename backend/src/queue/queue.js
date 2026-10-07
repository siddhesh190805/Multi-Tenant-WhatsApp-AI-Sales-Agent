const { Queue } = require("bullmq");
const { createRedisConnection } = require("./connection");

const MESSAGE_QUEUE_NAME = "whatsapp-ai-messages";

const messageQueue = new Queue(MESSAGE_QUEUE_NAME, {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 1000 },
  },
});

async function enqueueMessage(data) {
  return messageQueue.add("process-message", data, {
    jobId: data.messageId,
  });
}

module.exports = { MESSAGE_QUEUE_NAME, messageQueue, enqueueMessage };

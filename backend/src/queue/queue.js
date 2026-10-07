const { Queue } = require("bullmq");
const { createRedisConnection } = require("./connection");

const MESSAGE_QUEUE_NAME = "whatsapp-ai-messages";
const DLQ_QUEUE_NAME = "whatsapp-ai-dlq";
const connection = createRedisConnection();

const messageQueue = new Queue(MESSAGE_QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 8,
    backoff: { type: "exponential", delay: 500 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 1000 },
  },
});
const deadLetterQueue = new Queue(DLQ_QUEUE_NAME, { connection, defaultJobOptions: { removeOnComplete: { count: 500 } } });

async function enqueueMessage(data) {
  return messageQueue.add("process-message", data, { jobId: data.messageId, delay: data.debounceMs || 0 });
}
module.exports = { MESSAGE_QUEUE_NAME, DLQ_QUEUE_NAME, messageQueue, deadLetterQueue, enqueueMessage };

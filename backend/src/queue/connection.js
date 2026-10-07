const IORedis = require("ioredis");
const { getEnv } = require("../config/env");

function createRedisConnection() {
  return new IORedis(getEnv().redisUrl, {
    maxRetriesPerRequest: null,
  });
}

module.exports = { createRedisConnection };

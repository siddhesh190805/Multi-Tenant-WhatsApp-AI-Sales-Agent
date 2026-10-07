const mongoose = require("mongoose");
const { getEnv } = require("./env");

async function connectDatabase() {
  const { mongodbUri } = getEnv();
  await mongoose.connect(mongodbUri, {
    minPoolSize: 20,
    maxPoolSize: 50,
  });
}

async function disconnectDatabase() {
  await mongoose.disconnect();
}

module.exports = { connectDatabase, disconnectDatabase };

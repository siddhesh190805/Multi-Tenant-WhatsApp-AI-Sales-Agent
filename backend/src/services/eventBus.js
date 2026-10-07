const Redis = require("ioredis");
const { getEnv } = require("../config/env");
const publisher = new Redis(getEnv().redisUrl);
const subscriber = new Redis(getEnv().redisUrl, { enableReadyCheck: false });
const CHANNEL = "whatsapp-ai-events";
async function publishEvent(event) { await publisher.publish(CHANNEL, JSON.stringify(event)); }
function subscribeEvents(handler) {
  subscriber.subscribe(CHANNEL).catch((error) => console.error("[EVENT BUS]", error));
  subscriber.on("message", (_channel, raw) => { try { handler(JSON.parse(raw)); } catch (error) { console.error("[EVENT PARSE]", error); } });
}
module.exports = { publishEvent, subscribeEvents };

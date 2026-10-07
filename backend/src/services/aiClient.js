const { getEnv } = require("../config/env");

async function generateReply(payload) {
  const { aiServiceUrl, llmTimeoutMs } = getEnv();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), llmTimeoutMs);

  try {
    const response = await fetch(`${aiServiceUrl}/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      const error = new Error(`AI service returned ${response.status}: ${body}`);
      error.retryable = response.status === 429 || response.status >= 500;
      throw error;
    }

    return await response.json();
  } catch (error) {
    if (error.name === "AbortError") {
      error.retryable = true;
      error.code = "AI_TIMEOUT";
    } else if (error instanceof TypeError) {
      error.retryable = true;
      error.code = "AI_NETWORK_ERROR";
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { generateReply };

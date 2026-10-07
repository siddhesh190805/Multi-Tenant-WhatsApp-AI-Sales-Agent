function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withExponentialBackoff(operation, { attempts = 3, baseDelayMs = 250 } = {}) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      const retryable = error.retryable === true || error.code === "AI_TIMEOUT";
      if (!retryable || attempt === attempts) throw error;
      await sleep(baseDelayMs * 2 ** (attempt - 1));
    }
  }

  throw lastError;
}

module.exports = { withExponentialBackoff };

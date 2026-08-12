function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Retries an async function on failure, waiting `delaysMs[attempt]` between
 * attempts. Throws the last error if every attempt fails.
 */
export async function retryWithBackoff(
  fn,
  { retries = 3, delaysMs = [5000, 10000] } = {}
) {
  let lastError

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (attempt < retries - 1) {
        await wait(delaysMs[attempt] ?? delaysMs.at(-1))
      }
    }
  }

  throw lastError
}

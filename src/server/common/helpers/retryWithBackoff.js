function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Retries an async function on failure, waiting `delaysMs[attempt]` between
 * attempts. Throws the last error if every attempt fails, or immediately if
 * `isRetryable(err)` returns false — a permanent failure (e.g. a 4xx) gets
 * one attempt, not three.
 */
export async function retryWithBackoff(
  fn,
  { retries = 3, delaysMs = [5000, 10000], isRetryable = () => true } = {}
) {
  if (retries < 1) {
    throw new Error('retryWithBackoff: retries must be >= 1')
  }

  let lastError

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (attempt < retries - 1 && isRetryable(err)) {
        await wait(delaysMs[attempt] ?? delaysMs.at(-1))
      } else {
        break
      }
    }
  }

  throw lastError
}

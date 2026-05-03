export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

export async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  let lastError: unknown
  for (let i = 0; i <= retries; i += 1) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (i < retries) await sleep(500 * 2 ** i)
    }
  }
  throw lastError
}

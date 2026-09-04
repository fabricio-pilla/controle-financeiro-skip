// Helpers for rate limiting and backoff retry on HTTP 429 (Too Many Requests)

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

export const is429Error = (error: any): boolean => {
  return (
    error?.status === 429 ||
    error?.statusCode === 429 ||
    error?.response?.status === 429 ||
    error?.message?.includes('429')
  )
}

export interface RetryOptions {
  maxRetries?: number
  baseDelayMs?: number
  tag?: string
}

export const executeWithRetry = async <T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 500,
  tag = 'API',
): Promise<T> => {
  let attempt = 0
  while (true) {
    try {
      return await fn()
    } catch (error: any) {
      if (is429Error(error) && attempt < maxRetries) {
        attempt++
        const delay = baseDelayMs * Math.pow(2, attempt - 1)
        console.warn(
          `[${tag}] 429 detectado. Retentando em ${delay}ms (tentativa ${attempt}/${maxRetries})...`,
        )
        await sleep(delay)
        continue
      }
      throw error
    }
  }
}

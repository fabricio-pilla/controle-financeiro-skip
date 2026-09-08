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
  maxDelayMs?: number
}

export const executeWithRetry = async <T>(
  fn: () => Promise<T>,
  maxRetries = 5,
  baseDelayMs = 500,
  tag = 'API',
  maxDelayMs = 8000,
): Promise<T> => {
  let attempt = 0
  while (true) {
    try {
      return await fn()
    } catch (error: any) {
      if (is429Error(error) && attempt < maxRetries) {
        attempt++
        // Jitter to prevent stampedes when multiple requests get throttled
        const jitter = Math.random() * 200
        const calculatedDelay = baseDelayMs * Math.pow(1.8, attempt - 1) + jitter
        const delay = Math.min(calculatedDelay, maxDelayMs)
        console.warn(
          `[${tag}] 429 detectado. Retentando em ${Math.round(delay)}ms (tentativa ${attempt}/${maxRetries})...`,
        )
        await sleep(delay)
        continue
      }
      throw error
    }
  }
}

export interface RunInPoolOptions {
  concurrency?: number
  delayBetweenBatchesMs?: number
  tag?: string
}

/**
 * Runs a collection of tasks in controlled concurrent batches with backoff on 429.
 * Balances high throughput (concurrency = 3-4) while preserving rate limit headroom.
 */
export async function runInPool<TItem, TResult>(
  items: TItem[],
  task: (item: TItem, index: number) => Promise<TResult>,
  options: RunInPoolOptions = {},
): Promise<TResult[]> {
  const { concurrency = 4, delayBetweenBatchesMs = 25, tag = 'POOL' } = options
  if (items.length === 0) return []

  const results: TResult[] = new Array(items.length)
  let currentIndex = 0

  async function worker() {
    while (currentIndex < items.length) {
      const idx = currentIndex++
      const item = items[idx]
      const res = await executeWithRetry(() => task(item, idx), 5, 500, tag)
      results[idx] = res
      if (delayBetweenBatchesMs > 0) {
        await sleep(delayBetweenBatchesMs)
      }
    }
  }

  const workerCount = Math.min(concurrency, items.length)
  const workers = Array.from({ length: workerCount }, () => worker())
  await Promise.all(workers)

  return results
}

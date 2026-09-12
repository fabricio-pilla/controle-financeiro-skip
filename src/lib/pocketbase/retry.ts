// Helpers for rate limiting and backoff retry on HTTP 429 (Too Many Requests)

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

export const is429Error = (error: any): boolean => {
  if (!error) return false
  const status =
    error?.status ?? error?.statusCode ?? error?.response?.status ?? error?.originalError?.status
  if (status === 429) return true

  const message = String(error?.message || '')
  if (message.includes('429') || /too many requests/i.test(message)) {
    return true
  }

  const responseText = String(error?.response?.message || error?.data?.message || '')
  if (responseText.includes('429') || /too many requests/i.test(responseText)) {
    return true
  }

  return false
}

/**
 * Tenta extrair o header Retry-After em milissegundos se retornado pelo servidor
 */
export const extractRetryAfterMs = (error: any): number | null => {
  try {
    const headers = error?.response?.headers || error?.headers
    const rawVal =
      typeof headers?.get === 'function'
        ? headers.get('retry-after')
        : headers?.['retry-after'] || headers?.['Retry-After']

    if (rawVal) {
      const parsedSeconds = parseFloat(rawVal)
      if (!isNaN(parsedSeconds) && parsedSeconds > 0) {
        return Math.round(parsedSeconds * 1000)
      }
      const parsedDate = new Date(rawVal).getTime()
      if (!isNaN(parsedDate) && parsedDate > Date.now()) {
        return parsedDate - Date.now()
      }
    }
  } catch {
    // Header parsing falhou silenciosamente
  }
  return null
}

export interface RetryOptions {
  maxRetries?: number
  baseDelayMs?: number
  tag?: string
  maxDelayMs?: number
}

export const executeWithRetry = async <T>(
  fn: () => Promise<T>,
  maxRetries = 7,
  baseDelayMs = 1000,
  tag = 'API',
  maxDelayMs = 30000,
): Promise<T> => {
  let attempt = 0
  while (true) {
    try {
      return await fn()
    } catch (error: any) {
      if (is429Error(error) && attempt < maxRetries) {
        attempt++
        const serverRetryAfter = extractRetryAfterMs(error)
        // Jitter to prevent stampedes when multiple requests get throttled
        const jitter = Math.random() * 300
        // Backoff exponencial: 1s, 2s, 4s, 8s, 16s... até maxDelayMs (~30s)
        const exponentialDelay = baseDelayMs * Math.pow(2, attempt - 1) + jitter
        const delay = Math.min(
          serverRetryAfter && serverRetryAfter > 0 ? serverRetryAfter : exponentialDelay,
          maxDelayMs,
        )
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
  maxRetries?: number
  baseDelayMs?: number
  maxDelayMs?: number
  onProgress?: (completed: number, total: number) => void
}

/**
 * Runs a collection of tasks in controlled concurrent batches with backoff on 429.
 * Balances high throughput (concurrency = 2-4) while preserving rate limit headroom.
 */
export async function runInPool<TItem, TResult>(
  items: TItem[],
  task: (item: TItem, index: number) => Promise<TResult>,
  options: RunInPoolOptions = {},
): Promise<TResult[]> {
  const {
    concurrency = 4,
    delayBetweenBatchesMs = 25,
    tag = 'POOL',
    maxRetries = 5,
    baseDelayMs = 500,
    maxDelayMs = 30000,
    onProgress,
  } = options
  if (items.length === 0) return []

  const results: TResult[] = new Array(items.length)
  let currentIndex = 0
  let completedCount = 0

  async function worker() {
    while (currentIndex < items.length) {
      const idx = currentIndex++
      const item = items[idx]
      const res = await executeWithRetry(
        () => task(item, idx),
        maxRetries,
        baseDelayMs,
        tag,
        maxDelayMs,
      )
      results[idx] = res
      completedCount++
      if (onProgress) {
        try {
          onProgress(completedCount, items.length)
        } catch {
          // ignore callback error
        }
      }
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

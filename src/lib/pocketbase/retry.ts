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

export const isNetworkError = (error: any): boolean => {
  if (!error) return false
  const status =
    error?.status ?? error?.statusCode ?? error?.response?.status ?? error?.originalError?.status
  // PocketBase client returns status 0 on network disconnect/aborted request
  if (status === 0 || status === 502 || status === 503 || status === 504) return true

  const msg = String(error?.message || '').toLowerCase()
  if (
    msg.includes('network') ||
    msg.includes('fetch failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('timeout') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout')
  ) {
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
  on429?: (error: any, attempt: number, delayMs: number) => void
}

type Global429Listener = (error: any, attempt: number, delayMs: number) => void
const global429Listeners = new Set<Global429Listener>()

/**
 * Registra um callback global invocado quando qualquer requisição via executeWithRetry receber HTTP 429.
 * Retorna uma função de desinscrição.
 */
export const onGlobal429 = (listener: Global429Listener): (() => void) => {
  global429Listeners.add(listener)
  return () => {
    global429Listeners.delete(listener)
  }
}

/**
 * Notifica ouvintes globais sobre ocorrência de 429
 */
export const notify429 = (error: any, attempt: number, delayMs: number) => {
  for (const listener of global429Listeners) {
    try {
      listener(error, attempt, delayMs)
    } catch {
      // listener failure ignored silently
    }
  }
}

/**
 * Adaptive Rate Limiter para orquestração de requisições de criação/edição em massa.
 * Controla o espaçamento mínimo entre disparos de requisições subsequentes de forma compartilhada
 * entre todos os workers de um pool.
 */
export interface AdaptiveRateLimiterOptions {
  /** Intervalo base entre disparos de requisições (padrão: 180ms) */
  initialIntervalMs?: number
  /** Intervalo mínimo permitido sob condições perfeitas (padrão: 100ms) */
  minIntervalMs?: number
  /** Intervalo máximo permitido ao acumular desacelerações (padrão: 4000ms) */
  maxIntervalMs?: number
  /** Fator multiplicador de desaceleração ao receber 429 (padrão: 2.0) */
  backoffFactor?: number
  /** Fator de redução de espaçamento a cada sequência de sucessos (padrão: 0.9) */
  recoveryFactor?: number
  /** Número de sucessos consecutivos necessários para iniciar a reaceleração (padrão: 5) */
  successThresholdForRecovery?: number
}

export class AdaptiveRateLimiter {
  private currentIntervalMs: number
  private readonly minIntervalMs: number
  private readonly maxIntervalMs: number
  private readonly backoffFactor: number
  private readonly recoveryFactor: number
  private readonly successThresholdForRecovery: number

  private consecutiveSuccesses = 0
  private lastRequestTime = 0
  private pauseUntil = 0
  private unsubscribeGlobal429: (() => void) | null = null

  constructor(options: AdaptiveRateLimiterOptions = {}) {
    this.currentIntervalMs = options.initialIntervalMs ?? 180
    this.minIntervalMs = options.minIntervalMs ?? 100
    this.maxIntervalMs = options.maxIntervalMs ?? 4000
    this.backoffFactor = options.backoffFactor ?? 2.0
    this.recoveryFactor = options.recoveryFactor ?? 0.9
    this.successThresholdForRecovery = options.successThresholdForRecovery ?? 5

    // Conectar automaticamente ao ouvinte global de 429
    this.unsubscribeGlobal429 = onGlobal429((_err, _attempt, delayMs) => {
      this.recordThrottle(delayMs)
    })
  }

  /**
   * Obtém o intervalo atual em milissegundos
   */
  public getIntervalMs(): number {
    return this.currentIntervalMs
  }

  /**
   * Aguarda a sua vez de disparar uma requisição, garantindo espaçamento entre chamadas
   * e respeitando eventuais pausas globais causadas por 429.
   */
  public async waitTurn(): Promise<void> {
    const now = Date.now()
    let waitMs = 0

    // Se houver uma pausa explícita ativa decorrente de 429
    if (this.pauseUntil > now) {
      waitMs = Math.max(waitMs, this.pauseUntil - now)
    }

    // Intervalo de espaçamento desde a última requisição disparada
    const timeSinceLast = now - this.lastRequestTime
    if (timeSinceLast < this.currentIntervalMs) {
      waitMs = Math.max(waitMs, this.currentIntervalMs - timeSinceLast)
    }

    if (waitMs > 0) {
      await sleep(waitMs)
    }

    // Atualiza a marca da última requisição disparada
    this.lastRequestTime = Date.now()
  }

  /**
   * Registra uma desaceleração global ao receber aviso de rate limit (429)
   */
  public recordThrottle(suggestedDelayMs = 0): void {
    this.consecutiveSuccesses = 0
    this.currentIntervalMs = Math.min(
      this.maxIntervalMs,
      Math.max(this.currentIntervalMs * this.backoffFactor, 400),
    )

    // Pausa temporária para todos os workers
    const pauseDuration = suggestedDelayMs > 0 ? Math.min(suggestedDelayMs, 10000) : 1000
    this.pauseUntil = Math.max(this.pauseUntil, Date.now() + pauseDuration)
  }

  /**
   * Registra um sucesso: após um número de sucessos consecutivos, acelera gradualmente
   */
  public recordSuccess(): void {
    this.consecutiveSuccesses++
    if (
      this.consecutiveSuccesses >= this.successThresholdForRecovery &&
      this.currentIntervalMs > this.minIntervalMs
    ) {
      this.consecutiveSuccesses = 0
      this.currentIntervalMs = Math.max(
        this.minIntervalMs,
        Math.round(this.currentIntervalMs * this.recoveryFactor),
      )
    }
  }

  /**
   * Libera recursos e ouvinte global
   */
  public destroy(): void {
    if (this.unsubscribeGlobal429) {
      this.unsubscribeGlobal429()
      this.unsubscribeGlobal429 = null
    }
  }
}

export const executeWithRetry = async <T>(
  fn: () => Promise<T>,
  maxRetries = 7,
  baseDelayMs = 1000,
  tag = 'API',
  maxDelayMs = 30000,
  options?: RetryOptions,
): Promise<T> => {
  let attempt = 0
  while (true) {
    try {
      return await fn()
    } catch (error: any) {
      const is429 = is429Error(error)
      const isNet = isNetworkError(error)

      if ((is429 || isNet) && attempt < maxRetries) {
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

        // Se for erro 429, notifica ouvintes globais e o callback de opções
        if (is429) {
          notify429(error, attempt, delay)
          if (options?.on429) {
            try {
              options.on429(error, attempt, delay)
            } catch {
              // ignore callback error
            }
          }
        }

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
  rateLimiter?: AdaptiveRateLimiter
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
    rateLimiter,
  } = options
  if (items.length === 0) return []

  const results: TResult[] = new Array(items.length)
  let currentIndex = 0
  let completedCount = 0

  async function worker() {
    while (currentIndex < items.length) {
      const idx = currentIndex++
      const item = items[idx]

      // Throttle adaptativo compartilhado antes do disparo da requisição
      if (rateLimiter) {
        await rateLimiter.waitTurn()
      }

      try {
        const res = await executeWithRetry(
          () => task(item, idx),
          maxRetries,
          baseDelayMs,
          tag,
          maxDelayMs,
        )
        results[idx] = res
        if (rateLimiter) {
          rateLimiter.recordSuccess()
        }
      } catch (workerErr: any) {
        if (rateLimiter && is429Error(workerErr)) {
          rateLimiter.recordThrottle()
        }
        // Se a tarefa do item falhou mesmo após esgotar o retry (429 ou falha persistente),
        // registramos no índice e NÃO deixamos a exceção subir, mantendo os demais workers operantes.
        // O erro é tratado silenciosamente sem poluir o console do navegador.
        results[idx] = undefined as unknown as TResult
      } finally {
        completedCount++
        if (onProgress) {
          try {
            onProgress(completedCount, items.length)
          } catch {
            // ignore callback error
          }
        }
        if (delayBetweenBatchesMs > 0) {
          try {
            await sleep(delayBetweenBatchesMs)
          } catch {
            // ignore sleep interruption
          }
        }
      }
    }
  }

  const workerCount = Math.min(concurrency, items.length)
  const workers = Array.from({ length: workerCount }, () =>
    worker().catch(() => {
      // Barreira de proteção defensiva: nenhum worker deve rejeitar o Promise.all
    }),
  )
  await Promise.all(workers)

  return results
}

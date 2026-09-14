import { describe, it, expect, vi } from 'vitest'
import { runInPool, executeWithRetry, is429Error, isNetworkError } from './retry'

describe('pocketbase/retry helpers', () => {
  describe('is429Error', () => {
    it('detects 429 status and messages', () => {
      expect(is429Error({ status: 429 })).toBe(true)
      expect(is429Error({ statusCode: 429 })).toBe(true)
      expect(is429Error({ response: { status: 429 } })).toBe(true)
      expect(is429Error({ message: 'Error: 429 Too Many Requests' })).toBe(true)
      expect(is429Error({ response: { message: 'too many requests' } })).toBe(true)
      expect(is429Error({ status: 400 })).toBe(false)
      expect(is429Error(null)).toBe(false)
    })
  })

  describe('isNetworkError', () => {
    it('detects 0, 502, 503, 504 status and network messages', () => {
      expect(isNetworkError({ status: 0 })).toBe(true)
      expect(isNetworkError({ status: 502 })).toBe(true)
      expect(isNetworkError({ status: 503 })).toBe(true)
      expect(isNetworkError({ message: 'Failed to fetch' })).toBe(true)
      expect(isNetworkError({ message: 'NetworkError when attempting to fetch resource.' })).toBe(
        true,
      )
      expect(isNetworkError({ status: 404 })).toBe(false)
      expect(isNetworkError(null)).toBe(false)
    })
  })

  describe('runInPool', () => {
    it('processes all items with controlled concurrency and tracks onProgress', async () => {
      const items = [1, 2, 3, 4, 5, 6]
      const progressSnapshots: { completed: number; total: number }[] = []

      const results = await runInPool(
        items,
        async (item) => {
          return item * 10
        },
        {
          concurrency: 2,
          delayBetweenBatchesMs: 5,
          onProgress: (done, total) => {
            progressSnapshots.push({ completed: done, total })
          },
        },
      )

      expect(results).toEqual([10, 20, 30, 40, 50, 60])
      expect(progressSnapshots.length).toBe(6)
      expect(progressSnapshots[progressSnapshots.length - 1]).toEqual({
        completed: 6,
        total: 6,
      })
    })

    it('returns empty array when given empty list', async () => {
      const results = await runInPool([], async (x) => x)
      expect(results).toEqual([])
    })

    it('retries on 429 error and succeeds when next attempt passes', async () => {
      let callCount = 0
      const fn = async () => {
        callCount++
        if (callCount < 2) {
          throw { status: 429, message: 'Too Many Requests' }
        }
        return 'success'
      }

      const res = await executeWithRetry(fn, 3, 10, 'TestRetry', 50)
      expect(res).toBe('success')
      expect(callCount).toBe(2)
    })

    it('does not reject entire pool when a single item throws after exhausting retries', async () => {
      const items = ['ok1', 'fail', 'ok2']
      const results = await runInPool(
        items,
        async (item) => {
          if (item === 'fail') {
            throw { status: 429, message: 'Too Many Requests.' }
          }
          return `done-${item}`
        },
        { concurrency: 2, maxRetries: 1, baseDelayMs: 10, maxDelayMs: 50 },
      )

      expect(results[0]).toBe('done-ok1')
      expect(results[1]).toBeUndefined()
      expect(results[2]).toBe('done-ok2')
    })

    it('does not throw when task fails completely with 429 ClientResponseError', async () => {
      const items = ['item1', 'item2']
      const results = await runInPool(
        items,
        async () => {
          const err = new Error('Too Many Requests.')
          ;(err as any).status = 429
          throw err
        },
        { concurrency: 2, maxRetries: 0, baseDelayMs: 5 },
      )

      expect(results).toEqual([undefined, undefined])
    })

    it('does not log to console.warn or console.error during retries and exhausted failures', async () => {
      const warnSpy = vi.spyOn(console, 'warn')
      const errorSpy = vi.spyOn(console, 'error')

      let attempts = 0
      await executeWithRetry(
        async () => {
          attempts++
          if (attempts < 2) {
            throw { status: 429, message: 'Too Many Requests.' }
          }
          return 'ok'
        },
        2,
        5,
        'SilentTest',
        20,
      )

      await runInPool(
        ['task1'],
        async () => {
          throw { status: 429, message: 'Too Many Requests.' }
        },
        { concurrency: 1, maxRetries: 1, baseDelayMs: 5, maxDelayMs: 20 },
      )

      expect(warnSpy).not.toHaveBeenCalled()
      expect(errorSpy).not.toHaveBeenCalled()

      warnSpy.mockRestore()
      errorSpy.mockRestore()
    })
  })
})

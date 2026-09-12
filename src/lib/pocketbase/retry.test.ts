import { describe, it, expect, vi } from 'vitest'
import { runInPool, executeWithRetry, is429Error } from './retry'

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
  })
})

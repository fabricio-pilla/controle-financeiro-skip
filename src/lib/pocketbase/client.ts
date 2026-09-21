import PocketBase from 'pocketbase'
import { isNetworkError, sleep } from './retry'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

// Patch global send on the PocketBase client to retry transient network failures (TypeError: Failed to fetch, etc.)
// with exponential backoff (up to 3 retries) so that transient disconnections don't fail immediately.
const originalSend = pb.send.bind(pb)
pb.send = async function <T = any>(path: string, options: any): Promise<T> {
  const maxRetries = 3
  let attempt = 0

  while (true) {
    try {
      return await originalSend(path, options)
    } catch (err: any) {
      if (isNetworkError(err) && attempt < maxRetries) {
        attempt++
        const delay = Math.min(400 * Math.pow(2, attempt - 1) + Math.random() * 200, 3000)
        await sleep(delay)
        continue
      }
      throw err
    }
  }
}

export default pb

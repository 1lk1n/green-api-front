import { GreenApiError, type GreenApiClient } from '../api/greenApi'

export interface NotificationLoopOptions {
  client: Pick<GreenApiClient, 'receiveNotification' | 'deleteNotification'>
  signal: AbortSignal
  onNotification: (body: unknown) => void
  /** Called with the error when receiving fails, and with null once it works again. */
  onConnectionChange: (error: GreenApiError | null) => void
  receiveTimeoutSec?: number
  retryDelayMs?: (failures: number) => number
}

const defaultRetryDelay = (failures: number) => Math.min(30_000, 1000 * 2 ** (failures - 1))

/**
 * Receives notifications over the HTTP API until the signal is aborted:
 * ReceiveNotification (long poll) → handle → DeleteNotification, one at a time, in FIFO order.
 * https://green-api.com/v3/docs/api/receiving/technology-http-api/
 */
export async function runNotificationLoop({
  client,
  signal,
  onNotification,
  onConnectionChange,
  receiveTimeoutSec = 20,
  retryDelayMs = defaultRetryDelay,
}: NotificationLoopOptions): Promise<void> {
  let failures = 0
  while (!signal.aborted) {
    try {
      const notification = await client.receiveNotification(receiveTimeoutSec, signal)
      if (notification) {
        try {
          onNotification(notification.body)
        } catch (error) {
          // A notification that can't be handled must not block the queue forever.
          console.error('Failed to handle notification', notification.body, error)
        }
        await client.deleteNotification(notification.receiptId, signal)
      }
      if (failures > 0) {
        failures = 0
        onConnectionChange(null)
      }
    } catch (error) {
      if (signal.aborted) return
      failures += 1
      const apiError = error instanceof GreenApiError ? error : new GreenApiError(0, 'Не удалось получить уведомления')
      onConnectionChange(apiError)
      // Rejected credentials won't start working by themselves; the user has to sign in again.
      if (apiError.status === 401 || apiError.status === 403) return
      await sleep(retryDelayMs(failures), signal)
    }
  }
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', done)
      resolve()
    }
    const timer = setTimeout(done, ms)
    signal.addEventListener('abort', done, { once: true })
  })
}

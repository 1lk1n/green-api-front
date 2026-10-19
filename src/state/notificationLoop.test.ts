import { describe, expect, it, vi } from 'vitest'
import { GreenApiError, type ReceivedNotification } from '../api/greenApi'
import { runNotificationLoop } from './notificationLoop'

type Step = ReceivedNotification | null | Error

/** A client that replays the given receiveNotification results, then aborts the loop. */
function scriptedClient(steps: Step[], controller: AbortController) {
  const remaining = [...steps]
  return {
    receiveNotification: vi.fn(async (_receiveTimeoutSec: number, _signal?: AbortSignal) => {
      const step = remaining.shift()
      if (remaining.length === 0) queueMicrotask(() => controller.abort())
      if (step instanceof Error) throw step
      return step ?? null
    }),
    deleteNotification: vi.fn(async (_receiptId: number, _signal?: AbortSignal) => {}),
  }
}

describe('runNotificationLoop', () => {
  it('handles each notification and then deletes it from the queue', async () => {
    const controller = new AbortController()
    const client = scriptedClient(
      [{ receiptId: 1, body: 'first' }, null, { receiptId: 2, body: 'second' }, null],
      controller,
    )
    const onNotification = vi.fn()

    await runNotificationLoop({ client, signal: controller.signal, onNotification, onConnectionChange: vi.fn() })

    expect(onNotification.mock.calls).toEqual([['first'], ['second']])
    expect(client.deleteNotification.mock.calls.map(([receiptId]) => receiptId)).toEqual([1, 2])
    expect(client.receiveNotification).toHaveBeenCalledWith(20, controller.signal)
  })

  it('deletes a notification even if handling it throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const controller = new AbortController()
    const client = scriptedClient([{ receiptId: 1, body: 'broken' }, null], controller)

    await runNotificationLoop({
      client,
      signal: controller.signal,
      onNotification: () => {
        throw new Error('bug')
      },
      onConnectionChange: vi.fn(),
    })

    expect(client.deleteNotification).toHaveBeenCalledWith(1, controller.signal)
  })

  it('reports a failure, retries, and reports recovery', async () => {
    const controller = new AbortController()
    const failure = new GreenApiError(0, 'Нет соединения с сервером GREEN-API')
    const client = scriptedClient([failure, failure, null, null], controller)
    const onConnectionChange = vi.fn()
    const retryDelayMs = vi.fn(() => 0)

    await runNotificationLoop({
      client,
      signal: controller.signal,
      onNotification: vi.fn(),
      onConnectionChange,
      retryDelayMs,
    })

    expect(onConnectionChange.mock.calls).toEqual([[failure], [failure], [null]])
    expect(retryDelayMs.mock.calls).toEqual([[1], [2]])
  })

  it('stops when the credentials are rejected', async () => {
    const controller = new AbortController()
    const unauthorized = new GreenApiError(401, 'Неверный idInstance или apiTokenInstance')
    const client = scriptedClient([unauthorized, null, null], controller)
    const onConnectionChange = vi.fn()

    await runNotificationLoop({ client, signal: controller.signal, onNotification: vi.fn(), onConnectionChange })

    expect(client.receiveNotification).toHaveBeenCalledTimes(1)
    expect(onConnectionChange).toHaveBeenCalledWith(unauthorized)
  })

  it('does not start when already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    const client = scriptedClient([null], controller)

    await runNotificationLoop({ client, signal: controller.signal, onNotification: vi.fn(), onConnectionChange: vi.fn() })

    expect(client.receiveNotification).not.toHaveBeenCalled()
  })
})

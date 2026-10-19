import { vi } from 'vitest'

export const FAKE_ID_INSTANCE = '3100123456'
export const FAKE_TOKEN = 'fake-token'

/**
 * In-memory stand-in for the GREEN-API HTTP API, installed as global fetch.
 * Implements the methods the app uses, including a long-polling notification queue.
 */
export function installFakeGreenApi({ checkAccountDelayMs = 0 } = {}) {
  const notifications: Array<{ receiptId: number; body: unknown }> = []
  const listeners = new Set<() => void>()
  const accounts = new Map<string, string>()
  const sentMessages: Array<{ chatId: string; message: string }> = []
  let token = FAKE_TOKEN
  let nextReceiptId = 1
  let nextMessageId = 1

  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status })

  // Resolves after `ms`, or earlier through `wakers`; rejects like fetch when the request is aborted.
  function wait(ms: number, signal: AbortSignal | null | undefined, wakers?: Set<() => void>): Promise<void> {
    return new Promise((resolve, reject) => {
      const done = () => {
        clearTimeout(timer)
        wakers?.delete(done)
        resolve()
      }
      const timer = setTimeout(done, ms)
      wakers?.add(done)
      signal?.addEventListener('abort', () => {
        clearTimeout(timer)
        wakers?.delete(done)
        reject(new DOMException('Aborted', 'AbortError'))
      })
    })
  }

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input))
    const match = /^\/waInstance(\d+)\/(\w+)\/([^/]+)(?:\/(\d+))?$/.exec(url.pathname)
    if (!match || match[1] !== FAKE_ID_INSTANCE || decodeURIComponent(match[3]) !== token) {
      return new Response('', { status: 401 })
    }
    const body = init.body ? JSON.parse(String(init.body)) : undefined

    switch (match[2]) {
      case 'getStateInstance':
        return json({ stateInstance: 'authorized' })
      case 'getSettings':
        return json({ webhookUrl: '', incomingWebhook: 'yes', outgoingWebhook: 'yes' })
      case 'checkAccount': {
        if (checkAccountDelayMs) await wait(checkAccountDelayMs, init.signal)
        const chatId = accounts.get(String(body.phoneNumber))
        return json({ exist: Boolean(chatId), chatId: chatId ?? '', fromCache: false })
      }
      case 'sendMessage': {
        sentMessages.push(body)
        return json({ idMessage: `sent-${nextMessageId++}` })
      }
      case 'receiveNotification': {
        if (notifications.length === 0) await wait(50, init.signal, listeners)
        return json(notifications[0] ?? null)
      }
      case 'deleteNotification': {
        const index = notifications.findIndex((item) => item.receiptId === Number(match[4]))
        if (index !== -1) notifications.splice(index, 1)
        return json({ result: index !== -1 })
      }
      default:
        return json({ message: 'Not Found' }, 404)
    }
  })
  vi.stubGlobal('fetch', fetchMock)

  return {
    fetch: fetchMock,
    sentMessages,
    /** Registers a MAX user that checkAccount will find. */
    addAccount(phone: string, chatId: string) {
      accounts.set(phone, chatId)
    },
    /** Puts a notification into the queue, as GREEN-API does when something happens in MAX. */
    pushNotification(body: unknown) {
      notifications.push({ receiptId: nextReceiptId++, body })
      listeners.forEach((listener) => listener())
    },
    pendingNotifications: () => notifications.length,
    /** Simulates regenerating the instance token in the GREEN-API console. */
    changeToken(newToken: string) {
      token = newToken
    },
  }
}

export function incomingText(chatId: string, text: string, sender: Record<string, unknown> = {}) {
  return {
    typeWebhook: 'incomingMessageReceived',
    instanceData: { idInstance: Number(FAKE_ID_INSTANCE), wid: '79990000000@c.us', typeInstance: 'v3' },
    timestamp: Math.floor(Date.now() / 1000),
    idMessage: `in-${Math.random().toString(36).slice(2)}`,
    senderData: { chatId, chatType: 'user', sender: chatId, ...sender },
    messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: text } },
  }
}

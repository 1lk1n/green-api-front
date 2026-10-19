import { describe, expect, it, vi } from 'vitest'
import { createGreenApiClient, defaultApiUrl, GreenApiError } from './greenApi'

const credentials = { idInstance: '3100123456', apiTokenInstance: 'token-123', apiUrl: 'https://3100.api.green-api.com/' }
const base = 'https://3100.api.green-api.com/waInstance3100123456'

function mockFetch(status: number, body: unknown) {
  const fetchMock = vi.fn(async () =>
    new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function lastRequest(fetchMock: ReturnType<typeof mockFetch>) {
  const [url, init] = fetchMock.mock.lastCall as unknown as [string, RequestInit]
  return { url, init, body: init.body ? JSON.parse(String(init.body)) : undefined }
}

describe('defaultApiUrl', () => {
  it('derives the host from the first four digits of idInstance', () => {
    expect(defaultApiUrl('3100123456')).toBe('https://3100.api.green-api.com')
  })
})

describe('GREEN-API client', () => {
  it('sends a text message', async () => {
    const fetchMock = mockFetch(200, { idMessage: 'BAE5F4886F6F2D05' })

    const idMessage = await createGreenApiClient(credentials).sendMessage('10000000', 'Привет!')

    expect(idMessage).toBe('BAE5F4886F6F2D05')
    const { url, init, body } = lastRequest(fetchMock)
    expect(url).toBe(`${base}/sendMessage/token-123`)
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(body).toEqual({ chatId: '10000000', message: 'Привет!' })
  })

  it('receives a notification with a long poll', async () => {
    const fetchMock = mockFetch(200, { receiptId: 7, body: { typeWebhook: 'incomingMessageReceived' } })

    const notification = await createGreenApiClient(credentials).receiveNotification(20)

    expect(notification).toEqual({ receiptId: 7, body: { typeWebhook: 'incomingMessageReceived' } })
    const { url, init } = lastRequest(fetchMock)
    expect(url).toBe(`${base}/receiveNotification/token-123?receiveTimeout=20`)
    expect(init.method).toBe('GET')
  })

  it('returns null when the notification queue is empty', async () => {
    mockFetch(200, 'null')
    await expect(createGreenApiClient(credentials).receiveNotification(5)).resolves.toBeNull()

    mockFetch(200, '')
    await expect(createGreenApiClient(credentials).receiveNotification(5)).resolves.toBeNull()
  })

  it('deletes a notification by receiptId', async () => {
    const fetchMock = mockFetch(200, { result: true })

    await createGreenApiClient(credentials).deleteNotification(7)

    const { url, init } = lastRequest(fetchMock)
    expect(url).toBe(`${base}/deleteNotification/token-123/7`)
    expect(init.method).toBe('DELETE')
  })

  it('resolves a phone number with checkAccount', async () => {
    const fetchMock = mockFetch(200, { exist: true, chatId: '10000000', fromCache: true })

    await expect(createGreenApiClient(credentials).checkAccount('79991234567')).resolves.toEqual({
      exist: true,
      chatId: '10000000',
    })
    expect(lastRequest(fetchMock).body).toEqual({ phoneNumber: 79991234567 })
  })

  it('reports checkAccount failures that come back with HTTP 200', async () => {
    mockFetch(200, { status: false, reason: 'instance is starting or not authorized' })

    await expect(createGreenApiClient(credentials).checkAccount('79991234567')).rejects.toThrow(
      'instance is starting or not authorized',
    )
  })

  it('maps HTTP errors to readable messages', async () => {
    mockFetch(401, '')
    const unauthorized = await createGreenApiClient(credentials).getStateInstance().catch((error: unknown) => error)
    expect(unauthorized).toBeInstanceOf(GreenApiError)
    expect(unauthorized).toMatchObject({ status: 401, message: 'Неверный idInstance или apiTokenInstance' })

    mockFetch(466, { invokeStatus: { status: 'QUOTE_EXCEEDED', description: 'Monthly quota has been exceeded.' } })
    await expect(createGreenApiClient(credentials).checkAccount('79991234567')).rejects.toThrow(
      'Исчерпан лимит тарифа «Разработчик»: Monthly quota has been exceeded.',
    )

    mockFetch(400, { message: 'Validation failed', description: "'chatId' is required" })
    await expect(createGreenApiClient(credentials).sendMessage('', 'x')).rejects.toThrow('Validation failed')
  })

  it('reports network failures with status 0', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(createGreenApiClient(credentials).getStateInstance()).rejects.toMatchObject({
      status: 0,
      message: 'Нет соединения с сервером GREEN-API',
    })
  })

  it('passes cancellation through as an abort, not as an API error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
        })
      }),
    )
    const controller = new AbortController()

    const request = createGreenApiClient(credentials).receiveNotification(20, controller.signal)
    controller.abort()

    await expect(request).rejects.toMatchObject({ name: 'AbortError' })
  })
})

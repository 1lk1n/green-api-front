/**
 * Minimal GREEN-API client for MAX instances.
 * Docs: https://green-api.com/v3/docs/api/
 */

export interface Credentials {
  idInstance: string
  apiTokenInstance: string
  /** API host of the instance, e.g. https://3100.api.green-api.com */
  apiUrl: string
}

export type InstanceState =
  | 'notAuthorized'
  | 'authorized'
  | 'blocked'
  | 'starting'
  | 'suspended'
  | 'pendingPassword'

export interface InstanceSettings {
  webhookUrl?: string
  incomingWebhook?: string
  outgoingWebhook?: string
}

export interface ReceivedNotification {
  receiptId: number
  /** Raw notification body; parsed by `parseNotification`. */
  body: unknown
}

/** Error raised for any failed request. `status` is 0 when the server could not be reached. */
export class GreenApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'GreenApiError'
    this.status = status
  }
}

const REQUEST_TIMEOUT_MS = 30_000

/**
 * The API host is shown in the GREEN-API console; for MAX instances it is derived from
 * the first four digits of idInstance (3100… → https://3100.api.green-api.com).
 */
export function defaultApiUrl(idInstance: string): string {
  return `https://${idInstance.slice(0, 4)}.api.green-api.com`
}

interface RequestOptions {
  body?: unknown
  /** Extra path segment after the token, e.g. receiptId for deleteNotification. */
  pathSuffix?: string
  query?: Record<string, string | number>
  signal?: AbortSignal
  timeoutMs?: number
}

export function createGreenApiClient(credentials: Credentials) {
  const baseUrl = `${credentials.apiUrl.trim().replace(/\/+$/, '')}/waInstance${credentials.idInstance}`

  async function request<T>(
    httpMethod: 'GET' | 'POST' | 'DELETE',
    apiMethod: string,
    { body, pathSuffix, query, signal, timeoutMs = REQUEST_TIMEOUT_MS }: RequestOptions = {},
  ): Promise<T> {
    let url = `${baseUrl}/${apiMethod}/${encodeURIComponent(credentials.apiTokenInstance)}`
    if (pathSuffix !== undefined) url += `/${encodeURIComponent(pathSuffix)}`
    if (query) {
      url += `?${new URLSearchParams(Object.entries(query).map(([key, value]) => [key, String(value)]))}`
    }

    // Our own controller adds a timeout on top of the caller's signal.
    const controller = new AbortController()
    const abort = () => controller.abort()
    const timer = setTimeout(abort, timeoutMs)
    signal?.addEventListener('abort', abort, { once: true })
    if (signal?.aborted) abort()

    let status: number
    let text: string
    try {
      const response = await fetch(url, {
        method: httpMethod,
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      })
      status = response.status
      text = await response.text()
    } catch (error) {
      if (signal?.aborted) throw error
      throw new GreenApiError(
        0,
        controller.signal.aborted ? 'Сервер GREEN-API не отвечает' : 'Нет соединения с сервером GREEN-API',
      )
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
    }

    const data = parseJson(text)
    if (status < 200 || status >= 300) throw new GreenApiError(status, describeError(status, data))
    return data as T
  }

  return {
    /** https://green-api.com/v3/docs/api/account/GetStateInstance/ */
    async getStateInstance(signal?: AbortSignal): Promise<InstanceState> {
      const data = await request<{ stateInstance?: InstanceState } | null>('GET', 'getStateInstance', { signal })
      if (!data?.stateInstance) throw new GreenApiError(200, 'Некорректный ответ GREEN-API')
      return data.stateInstance
    },

    /** https://green-api.com/v3/docs/api/account/GetSettings/ */
    async getSettings(signal?: AbortSignal): Promise<InstanceSettings> {
      return (await request<InstanceSettings | null>('GET', 'getSettings', { signal })) ?? {}
    },

    /**
     * Resolves a phone number to the MAX chatId.
     * https://green-api.com/v3/docs/api/service/CheckAccount/
     */
    async checkAccount(phoneNumber: string, signal?: AbortSignal): Promise<{ exist: boolean; chatId: string }> {
      const data = await request<{ exist?: unknown; chatId?: unknown; reason?: unknown } | null>(
        'POST',
        'checkAccount',
        { body: { phoneNumber: Number(phoneNumber) }, signal },
      )
      // Some failures (e.g. instance not authorized) come back as HTTP 200 with { status: false, reason }.
      if (typeof data?.exist !== 'boolean') {
        throw new GreenApiError(200, typeof data?.reason === 'string' ? data.reason : 'Не удалось проверить номер')
      }
      return { exist: data.exist, chatId: typeof data.chatId === 'string' ? data.chatId : '' }
    },

    /** https://green-api.com/v3/docs/api/sending/SendMessage/ */
    async sendMessage(chatId: string, message: string): Promise<string> {
      const data = await request<{ idMessage?: unknown } | null>('POST', 'sendMessage', { body: { chatId, message } })
      if (typeof data?.idMessage !== 'string') throw new GreenApiError(200, 'Некорректный ответ GREEN-API')
      return data.idMessage
    },

    /**
     * Long-polls the notification queue. Resolves with null when nothing arrived within the timeout.
     * https://green-api.com/v3/docs/api/receiving/technology-http-api/ReceiveNotification/
     */
    async receiveNotification(receiveTimeoutSec: number, signal?: AbortSignal): Promise<ReceivedNotification | null> {
      const data = await request<{ receiptId?: unknown; body?: unknown } | null>('GET', 'receiveNotification', {
        query: { receiveTimeout: receiveTimeoutSec },
        signal,
        timeoutMs: receiveTimeoutSec * 1000 + REQUEST_TIMEOUT_MS,
      })
      if (typeof data?.receiptId !== 'number') return null
      return { receiptId: data.receiptId, body: data.body }
    },

    /** https://green-api.com/v3/docs/api/receiving/technology-http-api/DeleteNotification/ */
    async deleteNotification(receiptId: number, signal?: AbortSignal): Promise<void> {
      await request('DELETE', 'deleteNotification', { pathSuffix: String(receiptId), signal })
    },
  }
}

export type GreenApiClient = ReturnType<typeof createGreenApiClient>

function parseJson(text: string): unknown {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function describeError(status: number, data: unknown): string {
  const detail = errorDetail(data)
  switch (status) {
    case 401:
    case 403:
      return 'Неверный idInstance или apiTokenInstance'
    case 429:
      return 'Слишком много запросов, попробуйте позже'
    case 466:
      return `Исчерпан лимит тарифа «Разработчик»${detail ? `: ${detail}` : ''}`
    default:
      return detail ?? `Ошибка GREEN-API (HTTP ${status})`
  }
}

function errorDetail(data: unknown): string | undefined {
  if (typeof data === 'string') return data.trim() || undefined
  if (typeof data !== 'object' || data === null) return undefined
  const record = data as Record<string, unknown>
  const invokeStatus = record.invokeStatus as Record<string, unknown> | undefined
  for (const value of [record.message, record.description, record.reason, invokeStatus?.description]) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return undefined
}

import type { Credentials } from '../api/greenApi'
import { initialChatState, type Chat, type ChatMessage, type ChatState } from './chatReducer'

const CREDENTIALS_KEY = 'max-chat:credentials'
const MAX_STORED_MESSAGES_PER_CHAT = 500

const chatsKey = (idInstance: string) => `max-chat:chats:${idInstance}`

// Storage can be unavailable (private mode) or full; the app then simply keeps state in memory.
function read(key: string): unknown {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignored, see above
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // ignored, see above
  }
}

export function loadCredentials(): Credentials | null {
  const data = read(CREDENTIALS_KEY) as Partial<Credentials> | null
  if (
    typeof data?.idInstance === 'string' &&
    typeof data.apiTokenInstance === 'string' &&
    typeof data.apiUrl === 'string'
  ) {
    return { idInstance: data.idInstance, apiTokenInstance: data.apiTokenInstance, apiUrl: data.apiUrl }
  }
  return null
}

export function saveCredentials(credentials: Credentials): void {
  write(CREDENTIALS_KEY, credentials)
}

function isChat(value: unknown): value is Chat {
  const chat = value as Chat | null
  return (
    typeof chat?.chatId === 'string' &&
    Array.isArray(chat.messages) &&
    Number.isFinite(chat.unread) &&
    Number.isFinite(chat.updatedAt)
  )
}

function isMessage(value: unknown): value is ChatMessage {
  const message = value as ChatMessage | null
  return (
    typeof message?.id === 'string' &&
    typeof message.text === 'string' &&
    typeof message.outgoing === 'boolean' &&
    Number.isFinite(message.timestamp)
  )
}

export function loadChatState(idInstance: string): ChatState {
  const data = read(chatsKey(idInstance)) as { chats?: unknown; activeChatId?: unknown } | null
  if (!Array.isArray(data?.chats)) return initialChatState

  const chats = data.chats.filter(isChat).map((chat) => ({
    ...chat,
    messages: chat.messages.filter(isMessage).map((message) =>
      // A reload interrupted these sends, so whether they reached the server is unknown.
      message.status === 'pending' ? { ...message, status: 'failed' as const, error: 'Отправка была прервана' } : message,
    ),
  }))
  const activeChatId = chats.find((chat) => chat.chatId === data.activeChatId)?.chatId ?? null
  return { ...initialChatState, chats, activeChatId }
}

export function saveChatState(idInstance: string, { chats, activeChatId }: ChatState): void {
  write(chatsKey(idInstance), {
    activeChatId,
    chats: chats.map((chat) => ({ ...chat, messages: chat.messages.slice(-MAX_STORED_MESSAGES_PER_CHAT) })),
  })
}

export function clearCredentials(): void {
  remove(CREDENTIALS_KEY)
}

/** Forgets the credentials and the locally stored history of the instance. */
export function clearSession(idInstance: string): void {
  clearCredentials()
  remove(chatsKey(idInstance))
}

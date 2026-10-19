import type { ChatEvent } from '../lib/notifications'

export type DeliveryStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed'

export interface ChatMessage {
  /** idMessage from GREEN-API, or a local id while the message is being sent. */
  id: string
  text: string
  outgoing: boolean
  timestamp: number
  status?: DeliveryStatus
  error?: string
  /** Author name for incoming group messages. */
  author?: string
}

export interface Chat {
  /** MAX chat identifier: a number for personal chats, a negative number for groups. */
  chatId: string
  name?: string
  /** Normalized phone number (digits only), when known. */
  phone?: string
  isGroup?: boolean
  messages: ChatMessage[]
  unread: number
  /** Time of the last activity, used to order the chat list. */
  updatedAt: number
}

type StatusEvent = Extract<ChatEvent, { type: 'status' }>

export interface ChatState {
  chats: Chat[]
  activeChatId: string | null
  /**
   * Delivery reports for ids no message has yet: one can arrive before the SendMessage response
   * that assigns the id. Only the latest few are kept, in memory.
   */
  earlyStatuses: StatusEvent[]
}

export type ChatAction =
  | { type: 'chatOpened'; chatId: string; phone?: string; now: number }
  | { type: 'chatSelected'; chatId: string | null }
  | { type: 'messageQueued'; chatId: string; localId: string; text: string; timestamp: number }
  | { type: 'messageSent'; chatId: string; localId: string; idMessage: string }
  | { type: 'messageFailed'; chatId: string; localId: string; error: string }
  | { type: 'eventReceived'; event: ChatEvent }

export const initialChatState: ChatState = { chats: [], activeChatId: null, earlyStatuses: [] }

const MAX_EARLY_STATUSES = 20

// Statuses only move forward; "failed" can still be superseded by a later delivery report.
const STATUS_RANK: Record<DeliveryStatus, number> = { pending: 0, sent: 1, failed: 2, delivered: 3, read: 4 }

function updateChat(state: ChatState, chatId: string, update: (chat: Chat) => Chat): ChatState {
  return { ...state, chats: state.chats.map((chat) => (chat.chatId === chatId ? update(chat) : chat)) }
}

function updateMessage(chat: Chat, messageId: string, update: (message: ChatMessage) => ChatMessage): Chat {
  return { ...chat, messages: chat.messages.map((message) => (message.id === messageId ? update(message) : message)) }
}

function addMessage(state: ChatState, event: Extract<ChatEvent, { type: 'message' }>): ChatState {
  const existing = state.chats.find((chat) => chat.chatId === event.chatId)
  if (existing?.messages.some((message) => message.id === event.idMessage)) return state // redelivered notification

  const message: ChatMessage = {
    id: event.idMessage,
    text: event.text,
    outgoing: event.outgoing,
    timestamp: event.timestamp,
    status: event.outgoing ? 'sent' : undefined,
    author: event.senderName,
  }
  const chat = existing ?? { chatId: event.chatId, messages: [], unread: 0, updatedAt: 0 }
  const isUnread = !event.outgoing && state.activeChatId !== event.chatId
  const updated: Chat = {
    ...chat,
    name: event.chatName ?? chat.name,
    phone: chat.phone ?? event.senderPhone,
    isGroup: event.isGroup,
    messages: [...chat.messages, message],
    unread: isUnread ? chat.unread + 1 : chat.unread,
    updatedAt: Math.max(chat.updatedAt, event.timestamp),
  }
  return existing
    ? updateChat(state, event.chatId, () => updated)
    : { ...state, chats: [updated, ...state.chats] }
}

function applyStatus(state: ChatState, event: StatusEvent): ChatState {
  for (const chat of state.chats) {
    const message = chat.messages.find((item) => item.outgoing && item.id === event.idMessage)
    if (!message) continue
    if (STATUS_RANK[event.status] <= STATUS_RANK[message.status ?? 'pending']) return state
    return updateChat(state, chat.chatId, (current) =>
      updateMessage(current, message.id, (item) => ({ ...item, status: event.status, error: event.error })),
    )
  }
  return { ...state, earlyStatuses: [...state.earlyStatuses, event].slice(-MAX_EARLY_STATUSES) }
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'chatOpened': {
      const existing = state.chats.find((chat) => chat.chatId === action.chatId)
      if (existing) {
        return updateChat({ ...state, activeChatId: action.chatId }, action.chatId, (chat) => ({
          ...chat,
          phone: chat.phone ?? action.phone,
          unread: 0,
        }))
      }
      const chat: Chat = { chatId: action.chatId, phone: action.phone, messages: [], unread: 0, updatedAt: action.now }
      return { ...state, chats: [chat, ...state.chats], activeChatId: action.chatId }
    }

    case 'chatSelected': {
      const selected = { ...state, activeChatId: action.chatId }
      if (action.chatId === null) return selected
      return updateChat(selected, action.chatId, (chat) => (chat.unread ? { ...chat, unread: 0 } : chat))
    }

    case 'messageQueued':
      return updateChat(state, action.chatId, (chat) => ({
        ...chat,
        messages: [
          ...chat.messages,
          { id: action.localId, text: action.text, outgoing: true, timestamp: action.timestamp, status: 'pending' },
        ],
        updatedAt: Math.max(chat.updatedAt, action.timestamp),
      }))

    case 'messageSent': {
      const sent = updateChat(state, action.chatId, (chat) =>
        updateMessage(chat, action.localId, (message) => ({ ...message, id: action.idMessage, status: 'sent' })),
      )
      const early = state.earlyStatuses.filter((event) => event.idMessage === action.idMessage)
      if (early.length === 0) return sent
      const earlyStatuses = state.earlyStatuses.filter((event) => event.idMessage !== action.idMessage)
      return early.reduce(applyStatus, { ...sent, earlyStatuses })
    }

    case 'messageFailed':
      return updateChat(state, action.chatId, (chat) =>
        updateMessage(chat, action.localId, (message) => ({ ...message, status: 'failed', error: action.error })),
      )

    case 'eventReceived':
      switch (action.event.type) {
        case 'message':
          return addMessage(state, action.event)
        case 'status':
          return applyStatus(state, action.event)
        default:
          return state
      }
  }
}

/** Chats ordered by last activity, newest first. */
export function sortChats(chats: Chat[]): Chat[] {
  return [...chats].sort((a, b) => b.updatedAt - a.updatedAt)
}

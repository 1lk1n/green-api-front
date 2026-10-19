import type { Chat } from '../state/chatReducer'
import { formatPhone } from './phone'

export function chatTitle(chat: Chat): string {
  if (chat.name) return chat.name
  if (chat.phone) return formatPhone(chat.phone)
  return chat.isGroup ? 'Группа' : `Чат ${chat.chatId}`
}

export function chatSubtitle(chat: Chat): string {
  if (chat.isGroup) return 'Групповой чат'
  return chat.name && chat.phone ? formatPhone(chat.phone) : 'Личный чат'
}

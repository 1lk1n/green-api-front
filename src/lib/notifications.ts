import type { InstanceState } from '../api/greenApi'

/**
 * Domain events extracted from GREEN-API notifications.
 * Formats: https://green-api.com/v3/docs/api/receiving/notifications-format/
 */
export type ChatEvent =
  | {
      type: 'message'
      chatId: string
      idMessage: string
      text: string
      /** true for messages the account sent from another MAX client (phone, desktop). */
      outgoing: boolean
      timestamp: number
      isGroup: boolean
      chatName?: string
      /** Author name, set for incoming group messages. */
      senderName?: string
      /** Sender's phone number for incoming personal messages, when MAX discloses it. */
      senderPhone?: string
    }
  | { type: 'status'; idMessage: string; status: 'sent' | 'delivered' | 'read' | 'failed'; error?: string }
  | { type: 'state'; state: InstanceState }
  | { type: 'quota'; description: string }

type Json = Record<string, unknown>

function isRecord(value: unknown): value is Json {
  return typeof value === 'object' && value !== null
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

/** Text of a text-like message; null for media, polls, reactions and other unsupported types. */
function extractText(messageData: unknown): string | null {
  if (!isRecord(messageData)) return null
  switch (messageData.typeMessage) {
    case 'textMessage': {
      const data = messageData.textMessageData
      return isRecord(data) && typeof data.textMessage === 'string' ? data.textMessage : null
    }
    // Text with a link preview, and a reply quoting another message.
    case 'extendedTextMessage':
    case 'quotedMessage': {
      const data = messageData.extendedTextMessageData
      return isRecord(data) && typeof data.text === 'string' ? data.text : null
    }
    default:
      return null
  }
}

const STATUS_ERRORS: Record<string, string> = {
  failed: 'Ошибка при отправке сообщения на сервер MAX',
  noAccount: 'У получателя нет аккаунта MAX',
  notInGroup: 'Вы не участник этой группы',
}

/** Converts a raw notification body into a ChatEvent, or null if the app doesn't use it. */
export function parseNotification(body: unknown): ChatEvent | null {
  if (!isRecord(body)) return null

  switch (body.typeWebhook) {
    case 'incomingMessageReceived':
    case 'outgoingMessageReceived': {
      const sender = body.senderData
      const text = extractText(body.messageData)
      if (!isRecord(sender) || typeof sender.chatId !== 'string' || typeof body.idMessage !== 'string' || text === null) {
        return null
      }
      const outgoing = body.typeWebhook === 'outgoingMessageReceived'
      const isGroup = sender.chatType === 'group' || sender.chatId.startsWith('-')
      // In an incoming personal message the sender is the contact, so their details describe the chat.
      const fromContact = !outgoing && !isGroup
      const senderName = nonEmptyString(sender.senderContactName) ?? nonEmptyString(sender.senderName)
      const phone = String(sender.senderPhoneNumber ?? '')
      return {
        type: 'message',
        chatId: sender.chatId,
        idMessage: body.idMessage,
        text,
        outgoing,
        timestamp: typeof body.timestamp === 'number' ? body.timestamp * 1000 : Date.now(),
        isGroup,
        chatName: nonEmptyString(sender.chatName) ?? (fromContact ? senderName : undefined),
        senderName: isGroup && !outgoing ? senderName : undefined,
        senderPhone: fromContact && /^[1-9]\d{6,14}$/.test(phone) ? phone : undefined,
      }
    }

    case 'outgoingMessageStatus': {
      const { idMessage, status } = body
      if (typeof idMessage !== 'string' || typeof status !== 'string') return null
      if (status === 'sent' || status === 'delivered' || status === 'read') {
        return { type: 'status', idMessage, status }
      }
      if (Object.hasOwn(STATUS_ERRORS, status)) {
        const description = nonEmptyString(body.description)
        const error = description ? `${STATUS_ERRORS[status]} (${description})` : STATUS_ERRORS[status]
        return { type: 'status', idMessage, status: 'failed', error }
      }
      return null
    }

    case 'stateInstanceChanged':
      return typeof body.stateInstance === 'string' ? { type: 'state', state: body.stateInstance as InstanceState } : null

    case 'quotaExceeded': {
      const quota = isRecord(body.quotaData) ? body.quotaData : undefined
      return {
        type: 'quota',
        description: nonEmptyString(quota?.description) ?? 'Достигнут лимит тарифа «Разработчик»',
      }
    }

    default:
      return null
  }
}

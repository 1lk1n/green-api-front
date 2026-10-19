import { describe, expect, it } from 'vitest'
import { parseNotification } from './notifications'

const instanceData = { idInstance: 3100000000, wid: '79991234567@c.us', typeInstance: 'v3' }

function messageNotification(overrides: Record<string, unknown> = {}) {
  return {
    typeWebhook: 'incomingMessageReceived',
    instanceData,
    timestamp: 1763115112,
    idMessage: '1763115112345',
    senderData: {
      chatId: '10000000',
      chatName: 'Ходабрыш Пробешёлов',
      chatType: 'user',
      sender: '10000000',
      senderName: 'Ходабрыш',
      senderType: 'user',
      senderContactName: '',
      senderPhoneNumber: 79876543210,
    },
    messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'Привет от Green-API!' } },
    ...overrides,
  }
}

describe('parseNotification', () => {
  it('parses an incoming text message', () => {
    expect(parseNotification(messageNotification())).toEqual({
      type: 'message',
      chatId: '10000000',
      idMessage: '1763115112345',
      text: 'Привет от Green-API!',
      outgoing: false,
      timestamp: 1763115112000,
      isGroup: false,
      chatName: 'Ходабрыш Пробешёлов',
      senderName: undefined,
      senderPhone: '79876543210',
    })
  })

  it('reads the text of link and quoted messages', () => {
    for (const typeMessage of ['extendedTextMessage', 'quotedMessage']) {
      const event = parseNotification(
        messageNotification({ messageData: { typeMessage, extendedTextMessageData: { text: 'См. https://green-api.com' } } }),
      )
      expect(event).toMatchObject({ type: 'message', text: 'См. https://green-api.com' })
    }
  })

  it('falls back to the sender name when the chat has no name', () => {
    const event = parseNotification(
      messageNotification({ senderData: { chatId: '10000000', chatName: '', senderName: 'Иван', senderContactName: '' } }),
    )
    expect(event).toMatchObject({ chatName: 'Иван', senderPhone: undefined })
  })

  it('marks group messages and keeps the author', () => {
    const event = parseNotification(
      messageNotification({
        senderData: {
          chatId: '-69876543210123',
          chatName: 'Название группы',
          chatType: 'group',
          sender: '10000000',
          senderName: 'Ходабрыш',
          senderContactName: '',
          senderPhoneNumber: 0,
        },
      }),
    )
    expect(event).toMatchObject({
      chatId: '-69876543210123',
      isGroup: true,
      chatName: 'Название группы',
      senderName: 'Ходабрыш',
      senderPhone: undefined,
    })
  })

  it('treats messages sent from another MAX client as outgoing', () => {
    const event = parseNotification(messageNotification({ typeWebhook: 'outgoingMessageReceived' }))
    expect(event).toMatchObject({ type: 'message', outgoing: true, senderPhone: undefined })
  })

  it('ignores messages sent through the API, which the app already shows', () => {
    expect(parseNotification(messageNotification({ typeWebhook: 'outgoingAPIMessageReceived' }))).toBeNull()
  })

  it('ignores non-text messages', () => {
    const image = messageNotification({
      messageData: { typeMessage: 'imageMessage', fileMessageData: { downloadUrl: 'https://example.com/a.jpg' } },
    })
    expect(parseNotification(image)).toBeNull()
  })

  it('parses delivery statuses', () => {
    const status = { typeWebhook: 'outgoingMessageStatus', chatId: '10000000', instanceData, timestamp: 1, idMessage: 'm1' }
    expect(parseNotification({ ...status, status: 'read' })).toEqual({ type: 'status', idMessage: 'm1', status: 'read' })
    expect(parseNotification({ ...status, status: 'noAccount' })).toEqual({
      type: 'status',
      idMessage: 'm1',
      status: 'failed',
      error: 'У получателя нет аккаунта MAX',
    })
    expect(parseNotification({ ...status, status: 'toString' })).toBeNull()
  })

  it('parses instance state changes and quota notifications', () => {
    expect(parseNotification({ typeWebhook: 'stateInstanceChanged', stateInstance: 'notAuthorized' })).toEqual({
      type: 'state',
      state: 'notAuthorized',
    })
    expect(
      parseNotification({ typeWebhook: 'quotaExceeded', quotaData: { description: 'Monthly quota has been exceeded.' } }),
    ).toEqual({ type: 'quota', description: 'Monthly quota has been exceeded.' })
  })

  it('returns null for malformed input', () => {
    expect(parseNotification(null)).toBeNull()
    expect(parseNotification('text')).toBeNull()
    expect(parseNotification({ typeWebhook: 'incomingMessageReceived' })).toBeNull()
  })
})

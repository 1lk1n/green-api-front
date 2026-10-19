import { describe, expect, it } from 'vitest'
import type { ChatEvent } from '../lib/notifications'
import { chatReducer, initialChatState, sortChats, type ChatAction, type ChatState } from './chatReducer'

function reduce(actions: ChatAction[], state: ChatState = initialChatState): ChatState {
  return actions.reduce(chatReducer, state)
}

function incoming(overrides: Partial<Extract<ChatEvent, { type: 'message' }>> = {}): ChatAction {
  return {
    type: 'eventReceived',
    event: {
      type: 'message',
      chatId: '10000000',
      idMessage: 'in-1',
      text: 'Здравствуйте!',
      outgoing: false,
      timestamp: 2_000,
      isGroup: false,
      chatName: 'Иван',
      ...overrides,
    },
  }
}

const status = (idMessage: string, value: 'sent' | 'delivered' | 'read' | 'failed', error?: string): ChatAction => ({
  type: 'eventReceived',
  event: { type: 'status', idMessage, status: value, error },
})

describe('chatReducer', () => {
  it('opens a new chat and selects it', () => {
    const state = reduce([{ type: 'chatOpened', chatId: '10000000', phone: '79991234567', now: 1_000 }])

    expect(state.activeChatId).toBe('10000000')
    expect(state.chats).toEqual([{ chatId: '10000000', phone: '79991234567', messages: [], unread: 0, updatedAt: 1_000 }])
    expect(state.earlyStatuses).toEqual([])
  })

  it('reopens an existing chat instead of creating a duplicate', () => {
    const state = reduce([
      incoming(),
      { type: 'chatOpened', chatId: '10000000', phone: '79991234567', now: 5_000 },
    ])

    expect(state.chats).toHaveLength(1)
    expect(state.chats[0]).toMatchObject({ phone: '79991234567', unread: 0, name: 'Иван' })
  })

  it('creates a chat for a message from a new contact and counts it as unread', () => {
    const state = reduce([incoming()])

    expect(state.chats).toHaveLength(1)
    expect(state.chats[0]).toMatchObject({ chatId: '10000000', name: 'Иван', unread: 1, updatedAt: 2_000 })
    expect(state.chats[0].messages).toEqual([
      { id: 'in-1', text: 'Здравствуйте!', outgoing: false, timestamp: 2_000, status: undefined, author: undefined },
    ])
  })

  it('does not count messages in the open chat as unread', () => {
    const state = reduce([{ type: 'chatOpened', chatId: '10000000', now: 1_000 }, incoming()])

    expect(state.chats[0].unread).toBe(0)
  })

  it('ignores a redelivered notification', () => {
    const once = reduce([incoming()])

    expect(chatReducer(once, incoming())).toBe(once)
  })

  it('remembers the phone number disclosed by an incoming message', () => {
    const state = reduce([incoming({ senderPhone: '79991234567' })])

    expect(state.chats[0].phone).toBe('79991234567')
  })

  it('tracks an outgoing message from queued to read', () => {
    let state = reduce([
      { type: 'chatOpened', chatId: '10000000', now: 1_000 },
      { type: 'messageQueued', chatId: '10000000', localId: 'local-1', text: 'Привет', timestamp: 3_000 },
    ])
    expect(state.chats[0].messages[0]).toMatchObject({ id: 'local-1', outgoing: true, status: 'pending' })
    expect(state.chats[0].updatedAt).toBe(3_000)

    state = reduce([{ type: 'messageSent', chatId: '10000000', localId: 'local-1', idMessage: 'out-1' }], state)
    expect(state.chats[0].messages[0]).toMatchObject({ id: 'out-1', status: 'sent' })

    state = reduce([status('out-1', 'delivered'), status('out-1', 'read')], state)
    expect(state.chats[0].messages[0].status).toBe('read')
  })

  it('never moves a status backwards', () => {
    const state = reduce([
      { type: 'chatOpened', chatId: '10000000', now: 1_000 },
      { type: 'messageQueued', chatId: '10000000', localId: 'local-1', text: 'Привет', timestamp: 3_000 },
      { type: 'messageSent', chatId: '10000000', localId: 'local-1', idMessage: 'out-1' },
      status('out-1', 'read'),
    ])

    expect(chatReducer(state, status('out-1', 'delivered'))).toBe(state)
    expect(chatReducer(state, status('out-1', 'failed', 'oops'))).toBe(state)
  })

  it('applies a status that arrived before the SendMessage response', () => {
    let state = reduce([
      { type: 'chatOpened', chatId: '10000000', now: 1_000 },
      { type: 'messageQueued', chatId: '10000000', localId: 'local-1', text: 'Привет', timestamp: 3_000 },
      status('out-1', 'failed', 'Ошибка при отправке сообщения на сервер MAX'),
      status('other', 'read'),
    ])
    expect(state.earlyStatuses.map((event) => event.idMessage)).toEqual(['out-1', 'other'])

    state = chatReducer(state, { type: 'messageSent', chatId: '10000000', localId: 'local-1', idMessage: 'out-1' })

    expect(state.chats[0].messages[0]).toMatchObject({
      id: 'out-1',
      status: 'failed',
      error: 'Ошибка при отправке сообщения на сервер MAX',
    })
    expect(state.earlyStatuses.map((event) => event.idMessage)).toEqual(['other'])
  })

  it('keeps only the latest early statuses', () => {
    const state = reduce(Array.from({ length: 25 }, (_, index) => status(`unknown-${index}`, 'delivered')))

    expect(state.earlyStatuses).toHaveLength(20)
    expect(state.earlyStatuses[0].idMessage).toBe('unknown-5')
  })

  it('records why a message failed', () => {
    const queued = reduce([
      { type: 'chatOpened', chatId: '10000000', now: 1_000 },
      { type: 'messageQueued', chatId: '10000000', localId: 'local-1', text: 'Привет', timestamp: 3_000 },
    ])

    const failedToSend = chatReducer(queued, { type: 'messageFailed', chatId: '10000000', localId: 'local-1', error: 'Нет сети' })
    expect(failedToSend.chats[0].messages[0]).toMatchObject({ status: 'failed', error: 'Нет сети' })

    const sent = chatReducer(queued, { type: 'messageSent', chatId: '10000000', localId: 'local-1', idMessage: 'out-1' })
    const notDelivered = chatReducer(sent, status('out-1', 'failed', 'У получателя нет аккаунта MAX'))
    expect(notDelivered.chats[0].messages[0]).toMatchObject({ status: 'failed', error: 'У получателя нет аккаунта MAX' })
  })

  it('adds messages sent from another MAX client as outgoing', () => {
    const state = reduce([incoming({ idMessage: 'phone-1', outgoing: true, text: 'С телефона' })])

    expect(state.chats[0]).toMatchObject({ unread: 0 })
    expect(state.chats[0].messages[0]).toMatchObject({ outgoing: true, status: 'sent', text: 'С телефона' })
  })

  it('clears the unread counter when a chat is selected', () => {
    const state = reduce([incoming(), incoming({ idMessage: 'in-2' }), { type: 'chatSelected', chatId: '10000000' }])

    expect(state.activeChatId).toBe('10000000')
    expect(state.chats[0].unread).toBe(0)
  })
})

describe('sortChats', () => {
  it('puts the most recently active chat first', () => {
    const state = reduce([
      incoming({ chatId: 'a', idMessage: '1', timestamp: 1 }),
      incoming({ chatId: 'b', idMessage: '2', timestamp: 3 }),
      incoming({ chatId: 'c', idMessage: '3', timestamp: 2 }),
    ])

    expect(sortChats(state.chats).map((chat) => chat.chatId)).toEqual(['b', 'c', 'a'])
  })
})

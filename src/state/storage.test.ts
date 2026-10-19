import { describe, expect, it } from 'vitest'
import { initialChatState, type ChatState } from './chatReducer'
import {
  clearCredentials,
  clearSession,
  loadChatState,
  loadCredentials,
  saveChatState,
  saveCredentials,
} from './storage'

const credentials = { idInstance: '3100123456', apiTokenInstance: 'token', apiUrl: 'https://3100.api.green-api.com' }
const chatsKey = `max-chat:chats:${credentials.idInstance}`

const state: ChatState = {
  activeChatId: '10000000',
  earlyStatuses: [{ type: 'status', idMessage: 'unknown', status: 'delivered' }],
  chats: [
    {
      chatId: '10000000',
      phone: '79991234567',
      unread: 0,
      updatedAt: 1,
      messages: [
        { id: 'out-1', text: 'Привет', outgoing: true, timestamp: 1, status: 'read' },
        { id: 'local-1', text: 'Ещё', outgoing: true, timestamp: 2, status: 'pending' },
      ],
    },
  ],
}

describe('storage', () => {
  it('saves and restores credentials', () => {
    expect(loadCredentials()).toBeNull()
    saveCredentials(credentials)
    expect(loadCredentials()).toEqual(credentials)
  })

  it('restores chats per instance and marks interrupted sends as failed', () => {
    saveChatState(credentials.idInstance, state)

    const restored = loadChatState(credentials.idInstance)

    expect(restored.activeChatId).toBe('10000000')
    expect(restored.earlyStatuses).toEqual([])
    expect(restored.chats[0].messages[0]).toEqual(state.chats[0].messages[0])
    expect(restored.chats[0].messages[1]).toMatchObject({ status: 'failed', error: 'Отправка была прервана' })
    expect(loadChatState('3100999999')).toEqual(initialChatState)
  })

  it('ignores corrupted data', () => {
    localStorage.setItem(chatsKey, '{not json')
    localStorage.setItem('max-chat:credentials', '{"idInstance":1}')

    expect(loadChatState(credentials.idInstance)).toEqual(initialChatState)
    expect(loadCredentials()).toBeNull()
  })

  it('drops malformed chats and messages instead of failing to load', () => {
    const valid = { id: 'in-1', text: 'Привет', outgoing: false, timestamp: 1 }
    localStorage.setItem(
      chatsKey,
      JSON.stringify({
        activeChatId: 'gone',
        chats: [
          { chatId: '10000000', unread: 0, updatedAt: 1, messages: [valid, null, { id: 'x', text: 'no time', outgoing: false }] },
          { chatId: 42, unread: 0, updatedAt: 1, messages: [] },
        ],
      }),
    )

    const restored = loadChatState(credentials.idInstance)

    expect(restored.chats).toHaveLength(1)
    expect(restored.chats[0].messages).toEqual([valid])
    expect(restored.activeChatId).toBeNull()
  })

  it('can drop only the credentials and keep the history', () => {
    saveCredentials(credentials)
    saveChatState(credentials.idInstance, state)

    clearCredentials()

    expect(loadCredentials()).toBeNull()
    expect(loadChatState(credentials.idInstance).chats).toHaveLength(1)
  })

  it('forgets everything about the instance on logout', () => {
    saveCredentials(credentials)
    saveChatState(credentials.idInstance, state)

    clearSession(credentials.idInstance)

    expect(loadCredentials()).toBeNull()
    expect(loadChatState(credentials.idInstance).chats).toEqual([])
  })
})

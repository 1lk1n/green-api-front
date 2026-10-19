import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { App } from './App'
import { FAKE_ID_INSTANCE, FAKE_TOKEN, incomingText, installFakeGreenApi } from './test/fakeGreenApi'

async function logIn(user: ReturnType<typeof userEvent.setup>, token = FAKE_TOKEN) {
  await user.type(screen.getByLabelText('idInstance'), FAKE_ID_INSTANCE)
  await user.type(screen.getByLabelText('apiTokenInstance'), token)
  await user.click(screen.getByRole('button', { name: 'Войти' }))
}

async function startChat(user: ReturnType<typeof userEvent.setup>, phone: string) {
  // The header button; an empty list shows a second one.
  await user.click(screen.getAllByRole('button', { name: 'Новый чат' })[0])
  const dialog = screen.getByRole('dialog', { name: 'Новый чат' })
  await user.type(within(dialog).getByLabelText('Номер телефона получателя'), phone)
  await user.click(within(dialog).getByRole('button', { name: 'Создать чат' }))
}

describe('App', () => {
  it('sends a message to a new chat and shows the reply', async () => {
    const api = installFakeGreenApi()
    api.addAccount('79991234567', '10000001')
    const user = userEvent.setup()
    render(<App />)

    // 1. Sign in with the GREEN-API instance credentials.
    await logIn(user)
    expect(await screen.findByRole('heading', { name: 'Чаты' })).toBeInTheDocument()

    // 2. Create a chat by the recipient's phone number.
    await startChat(user, '8 (999) 123-45-67')
    const chat = await screen.findByRole('region', { name: 'Чат: +7 999 123-45-67' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    // 3. Write and send a text message.
    await user.type(within(chat).getByRole('textbox', { name: 'Сообщение' }), 'Привет!{Enter}')
    expect(await within(chat).findByText('Отправлено')).toBeInTheDocument()
    expect(within(chat).getByText('Привет!')).toBeInTheDocument()
    expect(api.sentMessages).toEqual([{ chatId: '10000001', message: 'Привет!' }])

    // 4. The recipient replies in MAX and reads our message.
    api.pushNotification(
      incomingText('10000001', 'Здравствуйте!', { chatName: 'Иван Петров', senderPhoneNumber: 79991234567 }),
    )
    api.pushNotification({ typeWebhook: 'outgoingMessageStatus', chatId: '10000001', idMessage: 'sent-1', status: 'read' })

    // 5. The reply shows up in the chat.
    expect(await within(chat).findByText('Здравствуйте!')).toBeInTheDocument()
    expect(await within(chat).findByText('Прочитано')).toBeInTheDocument()
    expect(within(chat).getByRole('heading', { name: 'Иван Петров' })).toBeInTheDocument()
    await waitFor(() => expect(api.pendingNotifications()).toBe(0))
  })

  it('rejects wrong credentials', async () => {
    installFakeGreenApi()
    const user = userEvent.setup()
    render(<App />)

    await logIn(user, 'wrong-token')

    expect(await screen.findByRole('alert')).toHaveTextContent('Неверный idInstance или apiTokenInstance')
    expect(screen.getByRole('button', { name: 'Войти' })).toBeEnabled()
  })

  it('explains when the phone number has no MAX account', async () => {
    installFakeGreenApi()
    const user = userEvent.setup()
    render(<App />)
    await logIn(user)
    await screen.findByRole('heading', { name: 'Чаты' })

    await startChat(user, '+7 900 000-00-00')

    expect(await screen.findByRole('alert')).toHaveTextContent('Этот номер не зарегистрирован в MAX')
    expect(screen.getByRole('dialog', { name: 'Новый чат' })).toBeInTheDocument()
  })

  it('does not open the chat if the dialog is closed during the search', async () => {
    const api = installFakeGreenApi({ checkAccountDelayMs: 100 })
    api.addAccount('79991234567', '10000001')
    const user = userEvent.setup()
    render(<App />)
    await logIn(user)
    await screen.findByRole('heading', { name: 'Чаты' })

    await startChat(user, '+7 999 123-45-67')
    expect(screen.getByRole('button', { name: 'Ищем в MAX…' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Закрыть' }))
    await new Promise((resolve) => setTimeout(resolve, 200))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: /Чат:/ })).not.toBeInTheDocument()
    expect(screen.getByText('Здесь пока пусто')).toBeInTheDocument()
  })

  it('signs in again after the token changes without losing the history', async () => {
    const api = installFakeGreenApi()
    api.addAccount('79991234567', '10000001')
    const user = userEvent.setup()
    render(<App />)
    await logIn(user)
    await startChat(user, '+7 999 123-45-67')
    const chat = await screen.findByRole('region', { name: 'Чат: +7 999 123-45-67' })
    await user.type(within(chat).getByRole('textbox', { name: 'Сообщение' }), 'Привет!{Enter}')
    await within(chat).findByText('Отправлено')

    api.changeToken('new-token')
    await user.click(await screen.findByRole('button', { name: 'Войти заново' }))
    await logIn(user, 'new-token')

    const restored = await screen.findByRole('region', { name: 'Чат: +7 999 123-45-67' })
    expect(within(restored).getByText('Привет!')).toBeInTheDocument()
  })

  it('lists a chat started by someone else with an unread counter', async () => {
    const api = installFakeGreenApi()
    const user = userEvent.setup()
    render(<App />)
    await logIn(user)
    await screen.findByRole('heading', { name: 'Чаты' })

    api.pushNotification(incomingText('10000002', 'Добрый день', { chatName: 'Мария' }))

    const item = await screen.findByRole('button', { name: /Мария/ })
    expect(item).toHaveTextContent('Добрый день')
    expect(item).toHaveTextContent('1 непрочитанных')

    await user.click(item)
    expect(await screen.findByRole('region', { name: 'Чат: Мария' })).toBeInTheDocument()
    expect(item).not.toHaveTextContent('непрочитанных')
  })

  it('keeps the session after a reload and forgets it on logout', async () => {
    installFakeGreenApi()
    const user = userEvent.setup()
    const { unmount } = render(<App />)
    await logIn(user)
    await screen.findByRole('heading', { name: 'Чаты' })
    unmount()

    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Чаты' })).toBeInTheDocument()

    vi.spyOn(window, 'confirm').mockReturnValue(true)
    await user.click(screen.getByRole('button', { name: 'Выйти' }))
    expect(screen.getByRole('button', { name: 'Войти' })).toBeInTheDocument()
  })
})

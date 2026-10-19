import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import {
  createGreenApiClient,
  type Credentials,
  type GreenApiError,
  type InstanceSettings,
  type InstanceState,
} from '../api/greenApi'
import { errorMessage } from '../lib/errors'
import { parseNotification } from '../lib/notifications'
import { chatReducer, sortChats } from '../state/chatReducer'
import { runNotificationLoop } from '../state/notificationLoop'
import { loadChatState, saveChatState } from '../state/storage'
import { ChatList } from './ChatList'
import { ChatView } from './ChatView'
import { ChatsIcon, ComposeIcon, Logo, LogoutIcon, WarningIcon } from './icons'
import { NewChatDialog } from './NewChatDialog'
import styles from './Messenger.module.css'

const STATE_PROBLEMS: Partial<Record<InstanceState, string>> = {
  notAuthorized: 'Инстанс не авторизован в MAX. Отсканируйте QR-код в личном кабинете GREEN-API.',
  starting: 'Инстанс запускается, это может занять до 5 минут.',
  blocked: 'Аккаунт MAX заблокирован.',
  suspended: 'Аккаунт MAX временно ограничен: сообщения доходят только до сохранённых контактов.',
  pendingPassword: 'Для входа в MAX нужен облачный пароль. Завершите авторизацию в личном кабинете GREEN-API.',
}

function settingsProblem(settings: InstanceSettings): string | null {
  if (settings.webhookUrl) {
    return 'В настройках инстанса указан webhookUrl, поэтому входящие сообщения не попадут в чат. Очистите его в личном кабинете GREEN-API.'
  }
  if (settings.incomingWebhook === 'no') {
    return 'Получение входящих сообщений отключено. Включите уведомления о входящих сообщениях в настройках инстанса.'
  }
  return null
}

let localIdCounter = 0
const createLocalId = () => `local-${Date.now()}-${++localIdCounter}`

interface Warning {
  text: string
  action?: { label: string; onClick: () => void }
}

interface MessengerProps {
  credentials: Credentials
  /** keepHistory: only the credentials are dropped, e.g. to sign in again with a new token. */
  onLogout: (options: { keepHistory: boolean }) => void
}

export function Messenger({ credentials, onLogout }: MessengerProps) {
  const { idInstance } = credentials
  const client = useMemo(() => createGreenApiClient(credentials), [credentials])
  const [state, dispatch] = useReducer(chatReducer, idInstance, loadChatState)
  const [instanceState, setInstanceState] = useState<InstanceState | null>(null)
  const [settingsWarning, setSettingsWarning] = useState<string | null>(null)
  const [quotaWarning, setQuotaWarning] = useState<string | null>(null)
  const [connectionError, setConnectionError] = useState<GreenApiError | null>(null)
  const [isNewChatOpen, setIsNewChatOpen] = useState(false)
  // Set on sign-out, so a save still pending from the last render can't bring the history back.
  const isSignedOut = useRef(false)

  useEffect(() => {
    if (!isSignedOut.current) saveChatState(idInstance, state)
  }, [idInstance, state])

  useEffect(() => {
    const controller = new AbortController()
    const ignore = () => {}
    client.getStateInstance(controller.signal).then(setInstanceState, ignore)
    client.getSettings(controller.signal).then((settings) => setSettingsWarning(settingsProblem(settings)), ignore)
    return () => controller.abort()
  }, [client])

  // Re-check a not yet authorized instance in case state notifications are disabled.
  useEffect(() => {
    if (instanceState === null || instanceState === 'authorized') return
    const timer = setInterval(() => {
      client.getStateInstance().then(setInstanceState, () => {})
    }, 30_000)
    return () => clearInterval(timer)
  }, [client, instanceState])

  useEffect(() => {
    const controller = new AbortController()
    void runNotificationLoop({
      client,
      signal: controller.signal,
      onConnectionChange: setConnectionError,
      onNotification: (body) => {
        const event = parseNotification(body)
        if (event?.type === 'state') setInstanceState(event.state)
        else if (event?.type === 'quota') setQuotaWarning(event.description)
        else if (event) dispatch({ type: 'eventReceived', event })
      },
    })
    return () => controller.abort()
  }, [client])

  async function sendMessage(chatId: string, text: string) {
    const localId = createLocalId()
    dispatch({ type: 'messageQueued', chatId, localId, text, timestamp: Date.now() })
    try {
      const idMessage = await client.sendMessage(chatId, text)
      dispatch({ type: 'messageSent', chatId, localId, idMessage })
    } catch (error) {
      dispatch({ type: 'messageFailed', chatId, localId, error: errorMessage(error) })
    }
  }

  async function openChatByPhone(phone: string, signal: AbortSignal) {
    const known = state.chats.find((chat) => chat.phone === phone)
    if (known) {
      dispatch({ type: 'chatSelected', chatId: known.chatId })
      return
    }
    // Always address the recipient by chatId: replies arrive with it, and the Developer plan
    // would count the same person under phone@c.us as a separate chat.
    const { exist, chatId } = await client.checkAccount(phone, signal)
    if (!exist || !chatId) throw new Error('Этот номер не зарегистрирован в MAX')
    dispatch({ type: 'chatOpened', chatId, phone, now: Date.now() })
  }

  function handleLogout() {
    if (!window.confirm('Выйти из аккаунта? История переписки на этом устройстве будет удалена.')) return
    isSignedOut.current = true
    onLogout({ keepHistory: false })
  }

  const chats = useMemo(() => sortChats(state.chats), [state.chats])
  const activeChat = state.chats.find((chat) => chat.chatId === state.activeChatId) ?? null

  const warnings: Warning[] = []
  if (connectionError?.status === 401 || connectionError?.status === 403) {
    warnings.push({
      text: 'GREEN-API отклонил ключ доступа: возможно, его сменили в личном кабинете.',
      action: { label: 'Войти заново', onClick: () => onLogout({ keepHistory: true }) },
    })
  } else if (connectionError) {
    const reason = connectionError.message.replace(/\.$/, '')
    warnings.push({ text: `Не удалось получить новые сообщения: ${reason}. Повторяем попытку…` })
  }
  for (const text of [instanceState && STATE_PROBLEMS[instanceState], settingsWarning, quotaWarning]) {
    if (text) warnings.push({ text })
  }

  return (
    <div className={styles.messenger} data-view={activeChat ? 'chat' : 'list'}>
      <nav className={styles.rail} aria-label="Разделы">
        <span className={styles.logo}>
          <Logo size={36} />
        </span>
        <button type="button" className={styles.railButton} aria-current="page">
          <ChatsIcon />
          <span>Чаты</span>
        </button>
        <button type="button" className={`${styles.railButton} ${styles.logout}`} onClick={handleLogout}>
          <LogoutIcon />
          <span>Выйти</span>
        </button>
      </nav>

      {warnings.length > 0 && (
        <div className={styles.banners} role="status">
          {warnings.map(({ text, action }) => (
            <div key={text} className={styles.banner}>
              <WarningIcon size={20} />
              <p className={styles.bannerText}>{text}</p>
              {action && (
                <button type="button" className={styles.bannerAction} onClick={action.onClick}>
                  {action.label}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <aside className={styles.sidebar} aria-label="Чаты">
        <header className={styles.sidebarHeader}>
          <h1 className={styles.sidebarTitle}>Чаты</h1>
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => setIsNewChatOpen(true)}
            aria-label="Новый чат"
            title="Новый чат"
          >
            <ComposeIcon />
          </button>
        </header>
        <ChatList
          chats={chats}
          activeChatId={state.activeChatId}
          onSelect={(chatId) => dispatch({ type: 'chatSelected', chatId })}
          onNewChat={() => setIsNewChatOpen(true)}
        />
      </aside>

      <main className={styles.main}>
        {activeChat ? (
          <ChatView
            key={activeChat.chatId}
            chat={activeChat}
            onSend={sendMessage}
            onBack={() => dispatch({ type: 'chatSelected', chatId: null })}
          />
        ) : (
          <div className={styles.placeholder}>
            <span className="capsule">Выберите чат или создайте новый</span>
          </div>
        )}
      </main>

      {isNewChatOpen && <NewChatDialog onSubmit={openChatByPhone} onClose={() => setIsNewChatOpen(false)} />}
    </div>
  )
}

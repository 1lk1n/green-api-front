import { chatTitle } from '../lib/chatTitle'
import { formatListTimestamp } from '../lib/format'
import type { Chat, ChatMessage } from '../state/chatReducer'
import { Avatar } from './Avatar'
import styles from './ChatList.module.css'

interface ChatListProps {
  chats: Chat[]
  activeChatId: string | null
  onSelect: (chatId: string) => void
  onNewChat: () => void
}

function previewPrefix(message: ChatMessage): string {
  if (message.outgoing) return 'Вы: '
  return message.author ? `${message.author}: ` : ''
}

export function ChatList({ chats, activeChatId, onSelect, onNewChat }: ChatListProps) {
  if (chats.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyTitle}>Здесь пока пусто</p>
        <p className={styles.emptyText}>Начните чат по номеру телефона, чтобы написать собеседнику в MAX</p>
        <button type="button" className={styles.emptyButton} onClick={onNewChat}>
          Новый чат
        </button>
      </div>
    )
  }

  return (
    <ul className={styles.list}>
      {chats.map((chat) => {
        const title = chatTitle(chat)
        const lastMessage = chat.messages.at(-1)
        return (
          <li key={chat.chatId}>
            <button
              type="button"
              className={styles.item}
              aria-current={chat.chatId === activeChatId ? 'true' : undefined}
              onClick={() => onSelect(chat.chatId)}
            >
              <Avatar id={chat.chatId} name={title} />
              <span className={styles.body}>
                <span className={styles.row}>
                  <span className={styles.title}>{title}</span>
                  {lastMessage && (
                    <time className={styles.time} dateTime={new Date(lastMessage.timestamp).toISOString()}>
                      {formatListTimestamp(lastMessage.timestamp)}
                    </time>
                  )}
                </span>
                <span className={styles.row}>
                  <span className={styles.preview}>
                    {lastMessage ? (
                      <>
                        <span className={styles.prefix}>{previewPrefix(lastMessage)}</span>
                        {lastMessage.text}
                      </>
                    ) : (
                      'Нет сообщений'
                    )}
                  </span>
                  {chat.unread > 0 && (
                    <span className={styles.badge}>
                      {chat.unread}
                      <span className="visually-hidden"> непрочитанных</span>
                    </span>
                  )}
                </span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

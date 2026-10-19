import { chatSubtitle, chatTitle } from '../lib/chatTitle'
import type { Chat } from '../state/chatReducer'
import { Avatar } from './Avatar'
import { Composer } from './Composer'
import { BackIcon } from './icons'
import { MessageList } from './MessageList'
import styles from './ChatView.module.css'

interface ChatViewProps {
  chat: Chat
  onSend: (chatId: string, text: string) => void
  onBack: () => void
}

export function ChatView({ chat, onSend, onBack }: ChatViewProps) {
  const title = chatTitle(chat)
  return (
    <section className={styles.chat} aria-label={`Чат: ${title}`}>
      <header className={styles.header}>
        <button type="button" className={styles.back} onClick={onBack} aria-label="Назад к списку чатов">
          <BackIcon />
        </button>
        <Avatar id={chat.chatId} name={title} size={40} />
        <div className={styles.heading}>
          <h2 className={styles.title}>{title}</h2>
          <p className={styles.subtitle}>{chatSubtitle(chat)}</p>
        </div>
      </header>
      <MessageList messages={chat.messages} />
      <Composer onSend={(text) => onSend(chat.chatId, text)} />
    </section>
  )
}

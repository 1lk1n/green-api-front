import { Fragment, useLayoutEffect, useRef } from 'react'
import { formatDayLabel, formatTime, isSameDay } from '../lib/format'
import type { ChatMessage, DeliveryStatus } from '../state/chatReducer'
import { CheckIcon, ClockIcon, DoubleCheckIcon, ErrorIcon } from './icons'
import styles from './MessageList.module.css'

const STATUS_VIEW: Record<DeliveryStatus, { label: string; Icon: typeof CheckIcon }> = {
  pending: { label: 'Отправляется', Icon: ClockIcon },
  sent: { label: 'Отправлено', Icon: CheckIcon },
  delivered: { label: 'Доставлено', Icon: DoubleCheckIcon },
  read: { label: 'Прочитано', Icon: DoubleCheckIcon },
  failed: { label: 'Не отправлено', Icon: ErrorIcon },
}

/** Bubbles from the same side and author on the same day are stacked together. */
function isStacked(a: ChatMessage | undefined, b: ChatMessage | undefined): boolean {
  return Boolean(a && b && a.outgoing === b.outgoing && a.author === b.author && isSameDay(a.timestamp, b.timestamp))
}

export function MessageList({ messages }: { messages: ChatMessage[] }) {
  const listRef = useRef<HTMLDivElement>(null)
  const isAtBottom = useRef(true)

  // Stay at the bottom while the user is there (new messages, statuses, error notes),
  // and jump down to a message they have just sent.
  useLayoutEffect(() => {
    const list = listRef.current
    if (list && (isAtBottom.current || messages.at(-1)?.status === 'pending')) list.scrollTop = list.scrollHeight
  }, [messages])

  function handleScroll() {
    const list = listRef.current
    if (list) isAtBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight < 64
  }

  if (messages.length === 0) {
    return (
      <div className={styles.empty}>
        <span className="capsule">Сообщений пока нет. Напишите первым!</span>
      </div>
    )
  }

  return (
    <div ref={listRef} className={styles.list} onScroll={handleScroll} role="log" aria-label="Сообщения">
      {messages.map((message, index) => {
        const previous = messages[index - 1]
        const isNewDay = !previous || !isSameDay(previous.timestamp, message.timestamp)
        const isFirstInStack = !isStacked(previous, message)
        return (
          <Fragment key={message.id}>
            {isNewDay && (
              <div className={styles.day}>
                <span className="capsule">{formatDayLabel(message.timestamp)}</span>
              </div>
            )}
            <MessageBubble
              message={message}
              isFirstInStack={isFirstInStack}
              isLastInStack={!isStacked(message, messages[index + 1])}
            />
          </Fragment>
        )
      })}
    </div>
  )
}

interface MessageBubbleProps {
  message: ChatMessage
  isFirstInStack: boolean
  isLastInStack: boolean
}

function MessageBubble({ message, isFirstInStack, isLastInStack }: MessageBubbleProps) {
  const status = message.outgoing ? STATUS_VIEW[message.status ?? 'sent'] : null
  return (
    <div
      className={styles.row}
      data-outgoing={message.outgoing || undefined}
      data-first={isFirstInStack || undefined}
      data-last={isLastInStack || undefined}
    >
      <div className={styles.bubble}>
        {message.author && isFirstInStack && <p className={styles.author}>{message.author}</p>}
        <p className={styles.text}>
          {message.text}
          <span className={styles.metaSpacer} aria-hidden="true" />
        </p>
        <span className={styles.meta}>
          <time dateTime={new Date(message.timestamp).toISOString()}>{formatTime(message.timestamp)}</time>
          {status && (
            <span className={styles.status} data-status={message.status} title={status.label}>
              <status.Icon size={16} />
              <span className="visually-hidden">{status.label}</span>
            </span>
          )}
        </span>
      </div>
      {message.status === 'failed' && message.error && <p className={styles.error}>{message.error}</p>}
    </div>
  )
}

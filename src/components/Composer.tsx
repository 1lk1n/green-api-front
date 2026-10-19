import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { SendIcon } from './icons'
import styles from './Composer.module.css'

/** SendMessage accepts up to 4000 characters. */
const MAX_MESSAGE_LENGTH = 4000
const MAX_INPUT_HEIGHT = 160

export function Composer({ onSend }: { onSend: (text: string) => void }) {
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const message = text.trim()

  useEffect(() => {
    // Focus right away with a mouse; on touch screens that would pop up the keyboard.
    if (window.matchMedia?.('(pointer: fine)').matches) inputRef.current?.focus()
  }, [])

  // Grow with the content up to a limit, then scroll.
  useLayoutEffect(() => {
    const input = inputRef.current
    if (!input) return
    input.style.height = 'auto'
    input.style.height = `${Math.min(input.scrollHeight, MAX_INPUT_HEIGHT)}px`
  }, [text])

  function send() {
    if (!message) return
    onSend(message)
    setText('')
    inputRef.current?.focus()
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    send()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter adds a line break; ignore Enter that confirms IME input.
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      send()
    }
  }

  return (
    <form className={styles.composer} onSubmit={handleSubmit}>
      <div className={styles.field}>
        <textarea
          ref={inputRef}
          className={styles.input}
          rows={1}
          placeholder="Сообщение"
          aria-label="Сообщение"
          maxLength={MAX_MESSAGE_LENGTH}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button type="submit" className={styles.send} disabled={!message} aria-label="Отправить" title="Отправить">
          <SendIcon size={20} />
        </button>
      </div>
    </form>
  )
}

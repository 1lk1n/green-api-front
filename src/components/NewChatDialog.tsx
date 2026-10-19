import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from 'react'
import { errorMessage } from '../lib/errors'
import { isSupportedPhone, normalizePhone } from '../lib/phone'
import { CloseIcon } from './icons'
import styles from './NewChatDialog.module.css'

interface NewChatDialogProps {
  /** Resolves the phone number (digits only) and opens the chat; rejects with a user-facing message. */
  onSubmit: (phone: string, signal: AbortSignal) => Promise<void>
  onClose: () => void
}

export function NewChatDialog({ onSubmit, onClose }: NewChatDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const searchRef = useRef<AbortController | null>(null)
  const pressedOnBackdrop = useRef(false)
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSearching, setIsSearching] = useState(false)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
    inputRef.current?.focus()
    // A search still running when the dialog goes away must not open the chat.
    return () => searchRef.current?.abort()
  }, [])

  // Closing through the element returns focus to the button that opened the dialog;
  // the resulting close event then unmounts it via onClose.
  const close = () => dialogRef.current?.close()

  // Clicks on the dialog element itself (not its content) land on the backdrop. Requiring the press
  // to start there too keeps a text selection dragged out of the input from closing the dialog.
  function handleMouseDown(event: MouseEvent<HTMLDialogElement>) {
    pressedOnBackdrop.current = event.target === event.currentTarget
  }

  function handleClick(event: MouseEvent<HTMLDialogElement>) {
    if (pressedOnBackdrop.current && event.target === event.currentTarget) close()
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const digits = normalizePhone(phone)
    if (!isSupportedPhone(digits)) {
      setError('Введите номер в формате +7 XXX XXX-XX-XX или +375 XX XXX-XX-XX')
      return
    }
    const search = new AbortController()
    searchRef.current = search
    setError(null)
    setIsSearching(true)
    try {
      await onSubmit(digits, search.signal)
      close()
    } catch (caught) {
      if (search.signal.aborted) return
      setError(errorMessage(caught))
      setIsSearching(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby="new-chat-title"
      onClose={onClose}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
    >
      <form className={styles.content} onSubmit={handleSubmit} noValidate>
        <header className={styles.header}>
          <h2 id="new-chat-title" className={styles.title}>
            Новый чат
          </h2>
          <button type="button" className={styles.close} onClick={close} aria-label="Закрыть">
            <CloseIcon />
          </button>
        </header>

        <label className={styles.field}>
          <span className={styles.label}>Номер телефона получателя</span>
          <input
            ref={inputRef}
            className={styles.input}
            type="tel"
            inputMode="tel"
            autoComplete="off"
            placeholder="+7 999 123-45-67"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            aria-describedby="new-chat-hint"
            aria-invalid={error ? true : undefined}
          />
        </label>
        <p id="new-chat-hint" className={styles.hint}>
          Номер должен быть зарегистрирован в MAX. Поддерживаются номера России и Беларуси.
        </p>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <button type="submit" className={styles.submit} disabled={isSearching}>
          {isSearching ? 'Ищем в MAX…' : 'Создать чат'}
        </button>
      </form>
    </dialog>
  )
}

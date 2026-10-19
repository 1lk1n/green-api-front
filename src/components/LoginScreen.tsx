import { useState, type FormEvent } from 'react'
import { createGreenApiClient, defaultApiUrl, GreenApiError, type Credentials } from '../api/greenApi'
import { errorMessage } from '../lib/errors'
import { Logo } from './icons'
import styles from './LoginScreen.module.css'

interface LoginScreenProps {
  onLogin: (credentials: Credentials) => void
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [idInstance, setIdInstance] = useState('')
  const [apiTokenInstance, setApiTokenInstance] = useState('')
  const [apiUrl, setApiUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isChecking, setIsChecking] = useState(false)

  const id = idInstance.trim()
  const isIdValid = /^\d{4,}$/.test(id)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const token = apiTokenInstance.trim()
    const url = apiUrl.trim() || (isIdValid ? defaultApiUrl(id) : '')
    if (!isIdValid) {
      setError('idInstance — это номер инстанса из личного кабинета, только цифры')
      return
    }
    if (!token) {
      setError('Укажите apiTokenInstance')
      return
    }
    if (!/^https?:\/\/[^\s/]+/.test(url)) {
      setError('API URL должен начинаться с https://')
      return
    }

    const credentials: Credentials = { idInstance: id, apiTokenInstance: token, apiUrl: url }
    setError(null)
    setIsChecking(true)
    try {
      // Any authorized request proves the credentials; the instance state is shown later in the chat.
      await createGreenApiClient(credentials).getStateInstance()
      onLogin(credentials)
    } catch (caught) {
      setIsChecking(false)
      setError(
        caught instanceof GreenApiError && caught.status === 0
          ? `Не удалось подключиться к ${url}. Проверьте idInstance или укажите API URL вручную.`
          : errorMessage(caught),
      )
    }
  }

  return (
    <main className={styles.screen}>
      <form className={styles.card} onSubmit={handleSubmit} noValidate>
        <Logo size={56} />
        <h1 className={styles.title}>Вход в MAX</h1>
        <p className={styles.subtitle}>
          Укажите параметры инстанса из{' '}
          <a href="https://console.green-api.com" target="_blank" rel="noreferrer">
            личного кабинета GREEN-API
          </a>
        </p>

        <label className={styles.field}>
          <span className={styles.label}>idInstance</span>
          <input
            className={styles.input}
            name="idInstance"
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            placeholder="3100123456"
            value={idInstance}
            onChange={(event) => setIdInstance(event.target.value)}
            autoFocus
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>apiTokenInstance</span>
          <input
            className={styles.input}
            name="apiTokenInstance"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="Ключ доступа инстанса"
            value={apiTokenInstance}
            onChange={(event) => setApiTokenInstance(event.target.value)}
          />
        </label>

        <details className={styles.advanced}>
          <summary>Дополнительно</summary>
          <label className={styles.field}>
            <span className={styles.label}>API URL</span>
            <input
              className={styles.input}
              name="apiUrl"
              type="url"
              autoComplete="off"
              spellCheck={false}
              placeholder={isIdValid ? defaultApiUrl(id) : 'https://3100.api.green-api.com'}
              value={apiUrl}
              onChange={(event) => setApiUrl(event.target.value)}
              aria-describedby="api-url-hint"
            />
          </label>
          <p id="api-url-hint" className={styles.hint}>
            Если не указан, определяется по idInstance
          </p>
        </details>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <button className={styles.submit} type="submit" disabled={isChecking}>
          {isChecking ? 'Проверяем…' : 'Войти'}
        </button>
        <p className={styles.note}>Данные для входа хранятся только в этом браузере</p>
      </form>
    </main>
  )
}

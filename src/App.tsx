import { useState } from 'react'
import type { Credentials } from './api/greenApi'
import { LoginScreen } from './components/LoginScreen'
import { Messenger } from './components/Messenger'
import { clearCredentials, clearSession, loadCredentials, saveCredentials } from './state/storage'

export function App() {
  const [credentials, setCredentials] = useState<Credentials | null>(loadCredentials)

  if (!credentials) {
    return (
      <LoginScreen
        onLogin={(value) => {
          saveCredentials(value)
          setCredentials(value)
        }}
      />
    )
  }

  return (
    <Messenger
      key={credentials.idInstance}
      credentials={credentials}
      onLogout={({ keepHistory }) => {
        if (keepHistory) clearCredentials()
        else clearSession(credentials.idInstance)
        setCredentials(null)
      }}
    />
  )
}

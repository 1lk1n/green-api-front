import type { CSSProperties } from 'react'
import { getInitials } from '../lib/format'
import { PersonIcon } from './icons'
import styles from './Avatar.module.css'

// Chat avatar gradients of web.max.ru.
const GRADIENTS: Array<[string, string]> = [
  ['#ff48b6', '#ff8a35'],
  ['#ffc93d', '#ff832a'],
  ['#14e1d5', '#03c722'],
  ['#08d7f3', '#5398ff'],
  ['#bf97ff', '#526eff'],
]

function hash(value: string): number {
  let result = 0
  for (const char of value) result = (result * 31 + char.charCodeAt(0)) >>> 0
  return result
}

interface AvatarProps {
  /** Stable identifier that picks the colour. */
  id: string
  name: string
  size?: number
}

export function Avatar({ id, name, size = 48 }: AvatarProps) {
  const [from, to] = GRADIENTS[hash(id) % GRADIENTS.length]
  const initials = getInitials(name)
  const style = { '--avatar-from': from, '--avatar-to': to, '--avatar-size': `${size}px` } as CSSProperties
  return (
    <span className={styles.avatar} style={style} aria-hidden="true">
      {initials || <PersonIcon size={Math.round(size * 0.55)} />}
    </span>
  )
}

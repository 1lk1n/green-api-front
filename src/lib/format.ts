const timeFormat = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' })
const shortDateFormat = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' })
const fullDateFormat = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
const dayFormat = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' })
const dayWithYearFormat = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })

const DAY_MS = 24 * 60 * 60 * 1000

function startOfDay(timestamp: number): number {
  const date = new Date(timestamp)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

export function isSameDay(a: number, b: number): boolean {
  return startOfDay(a) === startOfDay(b)
}

export function formatTime(timestamp: number): string {
  return timeFormat.format(timestamp)
}

/** Timestamp for the chat list: time today, "Вчера", a short date this year, a full date otherwise. */
export function formatListTimestamp(timestamp: number, now = Date.now()): string {
  const days = Math.round((startOfDay(now) - startOfDay(timestamp)) / DAY_MS)
  if (days <= 0) return formatTime(timestamp)
  if (days === 1) return 'Вчера'
  if (new Date(timestamp).getFullYear() === new Date(now).getFullYear()) {
    return shortDateFormat.format(timestamp).replace('.', '')
  }
  return fullDateFormat.format(timestamp)
}

/** Day separator label inside a conversation. */
export function formatDayLabel(timestamp: number, now = Date.now()): string {
  const days = Math.round((startOfDay(now) - startOfDay(timestamp)) / DAY_MS)
  if (days <= 0) return 'Сегодня'
  if (days === 1) return 'Вчера'
  return new Date(timestamp).getFullYear() === new Date(now).getFullYear()
    ? dayFormat.format(timestamp)
    : dayWithYearFormat.format(timestamp)
}

/** Up to two initials from the letters of a name; empty when the name has no letters. */
export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((word) => word.match(/\p{L}/u)?.[0] ?? '')
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

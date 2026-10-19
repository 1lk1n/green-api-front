import { describe, expect, it } from 'vitest'
import { formatDayLabel, formatListTimestamp, getInitials } from './format'

const now = new Date(2026, 9, 20, 15, 30).getTime()

describe('formatListTimestamp', () => {
  it('shows the time for today, "Вчера" for yesterday and a date otherwise', () => {
    expect(formatListTimestamp(new Date(2026, 9, 20, 9, 5).getTime(), now)).toBe('09:05')
    expect(formatListTimestamp(new Date(2026, 9, 19, 23, 59).getTime(), now)).toBe('Вчера')
    expect(formatListTimestamp(new Date(2026, 2, 8, 12, 0).getTime(), now)).toBe('8 мар')
    expect(formatListTimestamp(new Date(2025, 11, 31, 12, 0).getTime(), now)).toBe('31.12.2025')
  })
})

describe('formatDayLabel', () => {
  it('names recent days and spells out older dates', () => {
    expect(formatDayLabel(new Date(2026, 9, 20, 0, 1).getTime(), now)).toBe('Сегодня')
    expect(formatDayLabel(new Date(2026, 9, 19, 12, 0).getTime(), now)).toBe('Вчера')
    expect(formatDayLabel(new Date(2026, 9, 1, 12, 0).getTime(), now)).toBe('1 октября')
    expect(formatDayLabel(new Date(2025, 9, 1, 12, 0).getTime(), now)).toBe('1 октября 2025 г.')
  })
})

describe('getInitials', () => {
  it('takes the first letters of up to two words', () => {
    expect(getInitials('Иван Петров')).toBe('ИП')
    expect(getInitials('анна')).toBe('А')
    expect(getInitials('Мария Анна Иванова')).toBe('МА')
  })

  it('is empty when the name has no letters', () => {
    expect(getInitials('+7 999 123-45-67')).toBe('')
  })
})

import { describe, expect, it } from 'vitest'
import { formatPhone, isSupportedPhone, normalizePhone } from './phone'

describe('normalizePhone', () => {
  it('keeps only digits', () => {
    expect(normalizePhone('+7 (999) 123-45-67')).toBe('79991234567')
    expect(normalizePhone('+375 29 123 45 67')).toBe('375291234567')
  })

  it('turns the Russian trunk prefix 8 into 7', () => {
    expect(normalizePhone('8 999 123 45 67')).toBe('79991234567')
  })
})

describe('isSupportedPhone', () => {
  it('accepts Russian and Belarusian numbers', () => {
    expect(isSupportedPhone('79991234567')).toBe(true)
    expect(isSupportedPhone('375291234567')).toBe(true)
  })

  it('rejects other countries and wrong lengths', () => {
    expect(isSupportedPhone('7999123456')).toBe(false)
    expect(isSupportedPhone('380501234567')).toBe(false)
    expect(isSupportedPhone('')).toBe(false)
  })
})

describe('formatPhone', () => {
  it('formats Russian and Belarusian numbers', () => {
    expect(formatPhone('79991234567')).toBe('+7 999 123-45-67')
    expect(formatPhone('375291234567')).toBe('+375 29 123-45-67')
  })

  it('falls back to the raw international form', () => {
    expect(formatPhone('12025550123')).toBe('+12025550123')
  })
})

/** Strips formatting and turns the Russian trunk prefix 8 into the country code 7. */
export function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, '')
  return digits.length === 11 && digits.startsWith('8') ? `7${digits.slice(1)}` : digits
}

/** GREEN-API looks up MAX accounts only for Russian (+7) and Belarusian (+375) numbers. */
export function isSupportedPhone(digits: string): boolean {
  return /^7\d{10}$/.test(digits) || /^375\d{9}$/.test(digits)
}

export function formatPhone(digits: string): string {
  const ru = /^7(\d{3})(\d{3})(\d{2})(\d{2})$/.exec(digits)
  if (ru) return `+7 ${ru[1]} ${ru[2]}-${ru[3]}-${ru[4]}`
  const by = /^375(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(digits)
  if (by) return `+375 ${by[1]} ${by[2]}-${by[3]}-${by[4]}`
  return `+${digits}`
}

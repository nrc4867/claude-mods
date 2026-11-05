import { BAR_EMPTY, BAR_FULL, SAME_DAY_MS } from './constants'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

export const compactTokens = (n: number): string =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`

/** A bar `width` cells wide, filled in proportion to `part / whole`. */
export const bar = (part: number, whole: number, width: number): string => {
  const filled = whole <= 0 ? 0 : Math.min(width, Math.max(part > 0 ? 1 : 0, Math.round((part / whole) * width)))
  return BAR_FULL.repeat(filled) + BAR_EMPTY.repeat(width - filled)
}

export const lastSegment = (path: string): string => {
  const parts = path.replace(/\\/g, '/').split('/')
  return parts.slice(-2).join('/')
}

export const clock = (ms: number): string => {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** "14:30" for a reset within the day, "Tue 09:00" for one further out. */
export const resetTime = (ms: number, now: number): string =>
  ms - now < SAME_DAY_MS ? clock(ms) : `${WEEKDAYS[new Date(ms).getDay()]} ${clock(ms)}`

/** "1h 12m", "8m". */
export const duration = (ms: number): string => {
  const minutes = Math.max(0, Math.floor(ms / 60_000))
  const hours = Math.floor(minutes / 60)
  return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`
}

export const usd = (n: number): string => `$${n.toFixed(2)}`

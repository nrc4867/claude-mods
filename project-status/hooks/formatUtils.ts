export const basename = (path: string): string =>
  path.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? path

export const compactTokens = (n: number): string =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`

/** Compares paths across git's forward slashes and the host's separators and drive case. */
export const samePath = (a: string, b: string): boolean => {
  const norm = (p: string): string => p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
  return norm(a) === norm(b)
}

export const clock = (ms: number): string => {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

/** How long before `now` the time `at` was: `now`, `5m`, `3h`, `12d`. */
export const elapsed = (at: number, now: number): string => {
  const ms = Math.max(0, now - at)
  if (ms < MINUTE_MS) return 'now'
  if (ms < HOUR_MS) return `${Math.floor(ms / MINUTE_MS)}m`
  if (ms < DAY_MS) return `${Math.floor(ms / HOUR_MS)}h`
  return `${Math.floor(ms / DAY_MS)}d`
}

export const basename = (path: string): string =>
  path.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? path

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

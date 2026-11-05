/** `text` on one line, runs of whitespace collapsed, cut to `max` characters. */
export const oneLine = (text: string, max: number): string => {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat
}

/** The first of `fields` in `input` holding a non-empty string. */
export const firstString = (
  input: Readonly<Record<string, unknown>>,
  fields: readonly string[],
): string | undefined => {
  for (const field of fields) {
    const value = input[field]
    if (typeof value === 'string' && value.length > 0) return value
  }
  return undefined
}

/** A duration as `850ms`, `4.2s` or `3m12s`. */
export const formatMs = (ms: number): string => {
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  const minutes = Math.floor(ms / 60_000)
  return `${minutes}m${String(Math.floor((ms % 60_000) / 1000)).padStart(2, '0')}s`
}

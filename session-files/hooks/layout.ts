export type SectionSize = { count: number; isOpen: boolean }

/**
 * Rows each section may list within `budget`: shared evenly among the open
 * sections that have rows, a short section's spare rows going to the rest.
 */
export const allocateRows = (sizes: readonly SectionSize[], budget: number): number[] => {
  const wants = sizes.map(s => (s.isOpen ? s.count : 0))
  const shown = sizes.map(() => 0)
  let left = Math.max(0, budget)
  let active = wants.flatMap((want, i) => (want > 0 ? [i] : []))
  while (left > 0 && active.length > 0) {
    const share = Math.max(1, Math.floor(left / active.length))
    for (const i of active) {
      const take = Math.min(share, (wants[i] ?? 0) - (shown[i] ?? 0), left)
      shown[i] = (shown[i] ?? 0) + take
      left -= take
    }
    active = active.filter(i => (shown[i] ?? 0) < (wants[i] ?? 0))
  }
  return shown
}

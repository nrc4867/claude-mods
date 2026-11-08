import {
  MAX_QUOTED_LINES,
  REFLECTION_PATTERNS,
  TEST_PATH_PATTERNS,
  TIMED_WAIT_PATTERNS,
  type TestAntiPattern,
} from './constants'

/** Whether [filePath] holds tests. */
export const isTestFile = (filePath: string): boolean => TEST_PATH_PATTERNS.some(p => p.test(filePath))

const hitsOf = (lines: readonly string[], patterns: readonly TestAntiPattern[]): string[] =>
  lines.filter(line => patterns.some(p => p.pattern.test(line))).map(line => line.trim())

const quote = (hits: readonly string[]): string => hits.slice(0, MAX_QUOTED_LINES).map(l => `  ${l}`).join('\n')

/** A note for the model when added test code waits on the clock or reaches private members by reflection. */
export const testAntiPatternNote = (filePath: string, added: string): string | undefined => {
  if (!isTestFile(filePath)) return undefined
  const lines = added.split('\n')
  const notes: string[] = []

  const waits = hitsOf(lines, TIMED_WAIT_PATTERNS)
  if (waits.length > 0) {
    notes.push(
      `${filePath}: these added test lines wait on the clock:\n${quote(waits)}\n` +
        'The user treats sleeps, delays, waitUntil and poll loops in tests as bugs: they flake on slow CI and hide ' +
        "state the test should observe. Run the app's background work on the test's own dispatcher or clock " +
        '(inject it), or expose a suspend hook to await (awaitSettled, awaitLoaded), then remove the wait.',
    )
  }

  const reflection = hitsOf(lines, REFLECTION_PATTERNS)
  if (reflection.length > 0) {
    notes.push(
      `${filePath}: these added test lines use reflection to reach private members:\n${quote(reflection)}\n` +
        'The user does not allow tests to widen visibility by reflection. Test through the public surface, ' +
        'or give the code a real seam.',
    )
  }

  return notes.length === 0 ? undefined : notes.join('\n\n')
}

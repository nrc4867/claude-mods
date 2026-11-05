import type { EngineInterface } from 'claude-code'
import { CODE_EXTENSIONS, MAX_FILE_LINES, REWARN_STEP_LINES } from './constants'
import { extensionOf } from './pathUtils'

/** Line count each file was last warned at, for this module's lifetime. */
const warnedAt = new Map<string, number>()

const countLines = (text: string): number =>
  text.length === 0 ? 0 : text.split('\n').length - (text.endsWith('\n') ? 1 : 0)

/** A note for the model when the file is over the limit and not recently flagged. */
export async function fileLengthNote(
  $: EngineInterface,
  filePath: string,
): Promise<string | undefined> {
  if (!CODE_EXTENSIONS.has(extensionOf(filePath))) return undefined

  const lines = countLines(await $.fs.read(filePath))
  if (lines <= MAX_FILE_LINES) {
    warnedAt.delete(filePath)
    return undefined
  }

  const last = warnedAt.get(filePath)
  if (last !== undefined && lines < last + REWARN_STEP_LINES) return undefined
  warnedAt.set(filePath, lines)

  return `${filePath} is ${lines} lines, over the ${MAX_FILE_LINES}-line limit in CLAUDE.md. ` +
    'Split it by responsibility (helpers to utils/, constants, types) and tell the user you did, ' +
    'or tell them why this file should stay whole.'
}

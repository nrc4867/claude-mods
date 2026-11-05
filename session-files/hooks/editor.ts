import type { EngineInterface } from 'claude-code'
import {
  CMD_UNSAFE_PATH,
  EDITOR_LINE_FLAG,
  EDITOR_NAME,
  EDITOR_TIMEOUT_MS,
  EDITOR_WINDOWS_PREFIX,
  MAC_OPENER,
  OTHER_OPENER,
} from './constants'
import { hostPlatform, isWindowsHost } from './platform'

const failure = (absPath: string, reason: string): string => `Could not open ${absPath}: ${reason}`

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error))

/** Runs the command; null once it succeeded, else why it did not. */
async function attempt($: EngineInterface, argv: string[]): Promise<string | null> {
  try {
    const { exitCode, stderr } = await $.process.run(argv, { timeoutMs: EDITOR_TIMEOUT_MS })
    return exitCode === 0 ? null : stderr.trim() || `exit ${exitCode}`
  } catch (error) {
    return messageOf(error)
  }
}

/** Opens `absPath` in the editor, at `line` when given; a toast says so when it cannot. */
export async function openInEditor($: EngineInterface, absPath: string, line: number | null = null): Promise<void> {
  const at = line === null ? [] : [EDITOR_LINE_FLAG, String(line)]

  if (await isWindowsHost($)) {
    if (CMD_UNSAFE_PATH.test(absPath)) {
      $.ui.toast(failure(absPath, 'its name has characters the editor command cannot take'))
      return
    }
    const reason = await attempt($, [...EDITOR_WINDOWS_PREFIX, EDITOR_NAME, ...at, absPath])
    if (reason !== null) $.ui.toast(failure(absPath, reason))
    return
  }

  if ((await attempt($, [EDITOR_NAME, ...at, absPath])) === null) return
  // With no `idea` on the PATH, the file's default app stands in; it cannot take a line.
  const opener = (await hostPlatform($)) === 'mac' ? MAC_OPENER : OTHER_OPENER
  const reason = await attempt($, [opener, absPath])
  if (reason !== null) $.ui.toast(failure(absPath, reason))
}

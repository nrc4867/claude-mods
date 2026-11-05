import type { EngineInterface } from 'claude-code'
import { CMD_UNSAFE_PATH, EDITOR_ARGV, EDITOR_LINE_FLAG, EDITOR_TIMEOUT_MS } from './constants'

/** Opens `absPath` in the editor, at `line` when given; a toast says so when it cannot. */
export async function openInEditor($: EngineInterface, absPath: string, line: number | null = null): Promise<void> {
  if (CMD_UNSAFE_PATH.test(absPath)) {
    $.ui.toast(`Could not open ${absPath}: its name has characters the editor command cannot take`)
    return
  }
  const at = line === null ? [] : [EDITOR_LINE_FLAG, String(line)]
  try {
    const { exitCode, stderr } = await $.process.run([...EDITOR_ARGV, ...at, absPath], {
      timeoutMs: EDITOR_TIMEOUT_MS,
    })
    if (exitCode !== 0) $.ui.toast(`Could not open ${absPath}: ${stderr.trim() || `exit ${exitCode}`}`)
  } catch (error) {
    $.ui.toast(`Could not open ${absPath}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

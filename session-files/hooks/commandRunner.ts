import type { EngineInterface } from 'claude-code'
import type { CommandRun, SessionLink } from '../types'
import { appendOutput, cleanOutput } from './commandRules'
import { settleLostRuns, storeCommandRun } from './commandStore'
import { COMMAND_OUTPUT_FLUSH_MS, FALLBACK_SHELL, GIT_BASH_PATH, SHELL_COMMAND_FLAG } from './constants'

type LiveRun = { isStopping: boolean; stop: () => void }

/** The children this module started; unloading the module ends them. */
const live = new Map<string, LiveRun>()

async function findShell($: EngineInterface): Promise<string> {
  const configured = await $.env.get('CLAUDE_CODE_GIT_BASH_PATH')
  if (configured) return configured
  const stat = await $.fs.stat(GIT_BASH_PATH).catch(() => null)
  return stat?.kind === 'file' ? GIT_BASH_PATH : FALLBACK_SHELL
}

export function settleRunsLostToReload($: EngineInterface): Promise<unknown> {
  return settleLostRuns($, id => live.has(id))
}

/** Ends the child of a running command. */
export function stopCommand(id: string): void {
  const run = live.get(id)
  if (run === undefined) return
  run.isStopping = true
  run.stop()
}

/** Runs the command as a child of the session, keeping the end of its output for the pane. */
export async function runCommand($: EngineInterface, link: SessionLink): Promise<void> {
  if (live.has(link.id)) return
  const startedAt = Date.now()
  const base: CommandRun = { status: 'running', exitCode: null, output: '', startedAt, ms: null }
  let output = ''
  let lastFlush = startedAt
  const entry: LiveRun = { isStopping: false, stop: () => undefined }
  live.set(link.id, entry)
  await storeCommandRun($, link.id, base)

  const finish = (status: CommandRun['status'], exitCode: number | null): Promise<unknown> =>
    storeCommandRun($, link.id, { ...base, status, exitCode, output, ms: Date.now() - startedAt })

  try {
    const shell = await findShell($)
    const stream = $.process.spawn({
      argv: [shell, SHELL_COMMAND_FLAG, link.target],
      ...(link.cwd === null ? {} : { cwd: link.cwd }),
    })
    entry.stop = () => void stream.return(undefined as never).catch(() => undefined)
    for await (const { text } of stream) {
      if (entry.isStopping) break
      output = appendOutput(output, cleanOutput(text))
      if (Date.now() - lastFlush >= COMMAND_OUTPUT_FLUSH_MS) {
        lastFlush = Date.now()
        await storeCommandRun($, link.id, { ...base, output })
      }
    }
    if (entry.isStopping) {
      await finish('stopped', null)
      return
    }
    const { code } = await stream.result
    await finish(code === 0 ? 'ok' : 'failed', code)
  } catch (error) {
    if (entry.isStopping) {
      await finish('stopped', null)
      return
    }
    output = appendOutput(output, cleanOutput(error instanceof Error ? error.message : String(error)))
    await finish('failed', null)
  } finally {
    live.delete(link.id)
  }
}

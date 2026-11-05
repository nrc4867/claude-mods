import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'
import type { CommandRun } from '../types'

const commandRuns = atom({ plugin: 'session-files', key: 'commandRuns' } as const, {}, { shape: 'command-runs-1' })
const armedCommand = atom({ plugin: 'session-files', key: 'armedCommand' } as const, null)

export async function readCommandRuns($: EngineInterface): Promise<Readonly<Record<string, CommandRun>>> {
  return read($, commandRuns)
}

export async function readArmedCommand($: EngineInterface): Promise<string | null> {
  return read($, armedCommand)
}

export function armCommand($: EngineInterface, id: string | null): Promise<unknown> {
  return update($, armedCommand, () => id)
}

export function storeCommandRun($: EngineInterface, id: string, run: CommandRun): Promise<unknown> {
  return update($, commandRuns, runs => ({ ...runs, [id]: run }))
}

/** Runs still marked running whose child is gone, as after a reload, read as stopped. */
export function settleLostRuns($: EngineInterface, isAlive: (id: string) => boolean): Promise<unknown> {
  return update($, commandRuns, runs =>
    Object.fromEntries(
      Object.entries(runs).map(([id, run]) =>
        run.status === 'running' && !isAlive(id) ? [id, { ...run, status: 'stopped' as const }] : [id, run],
      ),
    ),
  )
}

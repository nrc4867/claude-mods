import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'
import type { ReadFile, SectionId, SectionsOpen, SessionLink, TouchedFile, ToolRun, ToolRunStatus } from '../types'
import { SECTIONS_DEFAULT } from './constants'
import { upsertLink } from './linkRules'
import type { Located, Measured } from './tracker'
import { finishRun, startRun, upsertFile, upsertRead } from './tracker'

// Every read and write of the mod's state lives here: the engine lists a
// module's values by scanning for atoms defined in the file that uses them.
// Change a tag when that value's fields change: it declines what an earlier
// version stored, which outlives a reload.
const files = atom({ plugin: 'session-files', key: 'files' } as const, [], { shape: 'files-2' })
const reads = atom({ plugin: 'session-files', key: 'reads' } as const, [], { shape: 'reads-1' })
const calls = atom({ plugin: 'session-files', key: 'calls' } as const, [], { shape: 'calls-1' })
const sections = atom({ plugin: 'session-files', key: 'sections' } as const, SECTIONS_DEFAULT, {
  shape: 'sections-1',
})

const links = atom({ plugin: 'session-files', key: 'links' } as const, [], { shape: 'links-2' })

export type Snapshot = {
  written: readonly TouchedFile[]
  read: readonly ReadFile[]
  runs: readonly ToolRun[]
  open: SectionsOpen
}

/** Everything the pane draws; reading it subscribes the drawing to changes. */
export async function readSnapshot($: EngineInterface): Promise<Snapshot> {
  const [written, readList, runs, open] = await Promise.all([
    read($, files), read($, reads), read($, calls), read($, sections),
  ])
  return { written, read: readList, runs, open }
}

export function storeEdit($: EngineInterface, measured: Measured): Promise<unknown> {
  return update($, files, list => upsertFile(list, measured))
}

export function storeRead($: EngineInterface, located: Located): Promise<unknown> {
  return update($, reads, list => upsertRead(list, located))
}

export function storeRunStart($: EngineInterface, run: ToolRun): Promise<unknown> {
  return update($, calls, list => startRun(list, run))
}

export function storeRunEnd($: EngineInterface, id: string, status: ToolRunStatus): Promise<unknown> {
  return update($, calls, list => finishRun(list, id, status))
}

/** The session's links, newest first; reading it subscribes the drawing to changes. */
export async function readLinks($: EngineInterface): Promise<readonly SessionLink[]> {
  return read($, links)
}

export function storeLink($: EngineInterface, link: SessionLink): Promise<unknown> {
  return update($, links, list => upsertLink(list, link))
}

export function toggleSection($: EngineInterface, id: SectionId): Promise<unknown> {
  return update($, sections, open => ({ ...open, [id]: !open[id] }))
}

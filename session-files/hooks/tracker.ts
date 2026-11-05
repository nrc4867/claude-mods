import type { EngineInterface } from 'claude-code'
import type { ReadFile, TouchedFile, ToolRun, ToolRunStatus } from '../types'
import { MAX_TRACKED_CALLS, MAX_TRACKED_FILES } from './constants'
import { absoluteFrom, countLines, relativeTo } from './fileUtils'

export type Located = Pick<ReadFile, 'path' | 'absPath'>
export type Measured = Located & Pick<TouchedFile, 'lines'>

/** The file's display path (relative to the session root) and absolute path. */
export async function locateFile($: EngineInterface, filePath: string): Promise<Located> {
  const root = await $.session.root()
  const absPath = absoluteFrom(root, filePath)
  return { path: relativeTo(root, absPath), absPath }
}

/** The edited file's display path, absolute path and line count now. */
export async function measureFile($: EngineInterface, filePath: string): Promise<Measured> {
  const located = await locateFile($, filePath)
  const text = await $.fs.read(located.absPath)
  return { ...located, lines: countLines(text) }
}

const moveToFront = <T extends { path: string }>(list: readonly T[], entry: T): T[] =>
  [entry, ...list.filter(f => f.path !== entry.path)].slice(0, MAX_TRACKED_FILES)

/** The list with `measured` moved to the front, its edit count bumped. */
export const upsertFile = (list: readonly TouchedFile[], measured: Measured): TouchedFile[] => {
  const prior = list.find(f => f.path === measured.path)
  return moveToFront(list, { ...measured, edits: (prior?.edits ?? 0) + 1, at: Date.now() })
}

/** The list with `located` moved to the front, its read count bumped. */
export const upsertRead = (list: readonly ReadFile[], located: Located): ReadFile[] => {
  const prior = list.find(f => f.path === located.path)
  return moveToFront(list, { ...located, reads: (prior?.reads ?? 0) + 1, at: Date.now() })
}

/** The list with `run` added, newest first. */
export const startRun = (list: readonly ToolRun[], run: ToolRun): ToolRun[] =>
  [run, ...list].slice(0, MAX_TRACKED_CALLS)

/** The list with call `id` settled as `status`, its wall time recorded. */
export const finishRun = (list: readonly ToolRun[], id: string, status: ToolRunStatus): ToolRun[] =>
  list.map(run => (run.id === id ? { ...run, status, ms: Date.now() - run.startedAt } : run))

/** Tool names with their call counts, busiest first. */
export const toolCounts = (list: readonly ToolRun[]): [string, number][] => {
  const counts = new Map<string, number>()
  for (const run of list) counts.set(run.tool, (counts.get(run.tool) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1])
}

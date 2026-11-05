import type { EngineInterface } from 'claude-code'
import type { FileChange, LastActivity } from '../types'
import { MAX_ACTIVITY_FILES } from './constants'
import { gitOut } from './gitRun'

const MS_PER_SECOND = 1000

/** Reads `git log --format=%ct`: seconds since the epoch; null when there is none. */
export const parseCommitTime = (stdout: string | null): number | null => {
  const seconds = Number(stdout?.trim() || NaN)
  return Number.isFinite(seconds) ? seconds * MS_PER_SECOND : null
}

/** The newer of the two times, named by where it came from. */
export const newestActivity = (commitAt: number | null, editAt: number | null): LastActivity | null => {
  if (commitAt === null && editAt === null) return null
  if (editAt !== null && (commitAt === null || editAt > commitAt)) return { at: editAt, kind: 'edit' }
  return { at: commitAt ?? 0, kind: 'commit' }
}

/** The newest change time among the files; a deleted file has none. */
async function newestFileTime($: EngineInterface, dir: string, files: readonly FileChange[]): Promise<number | null> {
  const stats = await Promise.all(
    files.slice(0, MAX_ACTIVITY_FILES).map(file => $.fs.stat(`${dir}/${file.path}`).catch(() => null)),
  )
  const times = stats.flatMap(stat => (stat === null ? [] : [stat.mtimeMs]))
  return times.length === 0 ? null : Math.max(...times)
}

/** When the worktree last saw work: its latest commit or its newest uncommitted file. */
export async function readLastActivity(
  $: EngineInterface,
  dir: string,
  files: readonly FileChange[],
): Promise<LastActivity | null> {
  const [commit, editAt] = await Promise.all([
    gitOut($, dir, ['log', '-1', '--format=%ct', 'HEAD']),
    newestFileTime($, dir, files),
  ])
  return newestActivity(parseCommitTime(commit), editAt)
}

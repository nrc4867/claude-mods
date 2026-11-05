import type { EngineInterface } from 'claude-code'
import type { LandedHow, MergeKind } from '../types'
import { BASE_BRANCHES, REMOTE } from './constants'
import { gitOut, gitRun, gitYes } from './gitRun'

/** The branch work lands on: the remote's default, else the first of BASE_BRANCHES present. */
export async function readBaseBranch($: EngineInterface, cwd: string): Promise<string | null> {
  const prefix = `${REMOTE}/`
  const remoteHead = await gitOut($, cwd, ['symbolic-ref', '--short', `refs/remotes/${REMOTE}/HEAD`])
  const named = remoteHead?.trim()
  const candidates = named?.startsWith(prefix)
    ? [named.slice(prefix.length), ...BASE_BRANCHES]
    : BASE_BRANCHES
  for (const name of candidates) {
    if (await gitYes($, cwd, ['show-ref', '--verify', '--quiet', `refs/heads/${name}`])) return name
  }
  return null
}

/** `origin/<base>` when the remote has it. */
export async function readRemoteBase(
  $: EngineInterface,
  cwd: string,
  base: string,
): Promise<string | null> {
  const ref = `refs/remotes/${REMOTE}/${base}`
  return (await gitYes($, cwd, ['show-ref', '--verify', '--quiet', ref])) ? `${REMOTE}/${base}` : null
}

/**
 * Whether `target` holds `ref`'s work: as its ancestor, as equivalent patches
 * (a rebase), or as content a merge would not change (a squash).
 */
export async function readLandedOn(
  $: EngineInterface,
  cwd: string,
  ref: string,
  target: string,
): Promise<LandedHow> {
  if (await gitYes($, cwd, ['merge-base', '--is-ancestor', ref, target])) return 'merged'

  const cherry = await gitOut($, cwd, ['cherry', target, ref])
  const lines = cherry?.split(/\r?\n/).filter(l => l.length > 0) ?? []
  if (lines.length > 0 && lines.every(l => l.startsWith('-'))) return 'patches'

  const merged = await gitOut($, cwd, ['merge-tree', '--write-tree', target, ref])
  const targetTree = await gitOut($, cwd, ['rev-parse', `${target}^{tree}`])
  const isSameTree =
    merged !== null && targetTree !== null && merged.split(/\r?\n/)[0] === targetTree.trim()
  return isSameTree ? 'content' : null
}

/** Reads `git merge-tree --write-tree --name-only`: the tree, the conflicted files, a blank line. */
export const parseConflictFiles = (stdout: string): string[] => {
  const [, ...lines] = stdout.split(/\r?\n/)
  const end = lines.indexOf('')
  return end === -1 ? lines : lines.slice(0, end)
}

/** The files a merge of `ref` into `base` would leave conflicted. */
export async function readConflictFiles(
  $: EngineInterface,
  cwd: string,
  ref: string,
  base: string,
): Promise<string[]> {
  const merged = await gitRun($, cwd, ['merge-tree', '--write-tree', '--name-only', base, ref])
  return merged?.exitCode === 1 ? parseConflictFiles(merged.stdout) : []
}

/** What taking `ref` into `base` would need. */
export async function readMergeKind(
  $: EngineInterface,
  cwd: string,
  ref: string,
  base: string,
): Promise<MergeKind> {
  if (await gitYes($, cwd, ['merge-base', '--is-ancestor', ref, base])) return 'none'
  if (await gitYes($, cwd, ['merge-base', '--is-ancestor', base, ref])) return 'ff'

  // merge-tree exits 1 for a merge with conflicts and above that for a failure.
  const merged = await gitRun($, cwd, ['merge-tree', '--write-tree', '--name-only', base, ref])
  if (merged?.exitCode === 0) return 'rebase'
  return merged?.exitCode === 1 ? 'conflicts' : 'unknown'
}

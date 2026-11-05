import type { EngineInterface } from 'claude-code'
import type { FileChange, GitOverview, LandedHow, LocalBranch, MergeKind, Worktree } from '../types'
import { readLastActivity } from './activity'
import { samePath } from './formatUtils'
import { gitOut } from './gitRun'
import { readBaseBranch, readLandedOn, readMergeKind, readRemoteBase } from './landing'

type Listed = Pick<Worktree, 'path' | 'head' | 'branch'>

const BRANCH_REF = 'refs/heads/'

const fieldOf = (lines: string[], name: string): string | undefined =>
  lines.find(l => l.startsWith(`${name} `))?.slice(name.length + 1)

/** Reads `git worktree list --porcelain`, leaving out a bare repo's entry. */
export const parseWorktreeList = (stdout: string): Listed[] =>
  stdout
    .split(/\r?\n\r?\n/)
    .map(block => block.split(/\r?\n/))
    .filter(lines => lines[0]?.startsWith('worktree ') && !lines.includes('bare'))
    .map(lines => ({
      path: fieldOf(lines, 'worktree') ?? '',
      head: fieldOf(lines, 'HEAD') ?? '',
      branch: fieldOf(lines, 'branch')?.replace(BRANCH_REF, '') ?? null,
    }))

const QUOTE_PATH_OFF = ['-c', 'core.quotePath=false']

/** Git wraps a path holding spaces or quotes in double quotes, with backslash escapes. */
export const unquotePath = (path: string): string =>
  path.startsWith('"') && path.endsWith('"')
    ? path.slice(1, -1).replace(/\\(.)/g, (_, c: string) => (c === 't' ? '\t' : c === 'n' ? '\n' : c))
    : path

const parseTrack = (text: string): { ahead: number; behind: number } => ({
  ahead: Number(/\bahead (\d+)/.exec(text)?.[1] ?? 0),
  behind: Number(/\bbehind (\d+)/.exec(text)?.[1] ?? 0),
})

/** Reads `git status --porcelain=v1 -b`: the head line's counts, then one entry a file. */
export const parseStatus = (
  stdout: string,
): { ahead: number; behind: number; files: FileChange[] } => {
  const [head = '', ...entries] = stdout.split(/\r?\n/).filter(l => l.length > 0)
  return {
    ...parseTrack(head),
    files: entries.map(l => ({ code: l.slice(0, 2), path: unquotePath(l.slice(3)) })),
  }
}

/** Reads `git diff --name-status --no-renames`: a code, a tab, a path. */
export const parseNameStatus = (stdout: string): FileChange[] =>
  stdout
    .split(/\r?\n/)
    .filter(l => l.length > 0)
    .map(l => {
      const [code = '', path = ''] = l.split('\t')
      return { code: code.padEnd(2), path: unquotePath(path) }
    })

/** Reads `git for-each-ref` lines of the name, a tab, and the upstream's track. */
export const parseBranches = (stdout: string): LocalBranch[] =>
  stdout
    .split(/\r?\n/)
    .filter(l => l.length > 0)
    .map(l => {
      const [name = '', track = ''] = l.split('\t')
      return { name, ...parseTrack(track) }
    })

type Landing = Pick<Worktree, 'committed' | 'landed' | 'landedOn' | 'merge'>

const NOT_COMPARED: Landing = { committed: [], landed: null, landedOn: null, merge: 'none' }

async function readLanding(
  $: EngineInterface,
  one: Listed,
  base: string | null,
  remoteBase: string | null,
): Promise<Landing> {
  if (base === null || one.branch === base) return NOT_COMPARED

  const ref = one.branch ?? one.head
  let landed: LandedHow = null
  let landedOn: string | null = null
  for (const target of remoteBase === null ? [base] : [base, remoteBase]) {
    landed = await readLandedOn($, one.path, ref, target)
    if (landed !== null) {
      landedOn = target
      break
    }
  }

  const diff = await gitOut($, one.path, [
    ...QUOTE_PATH_OFF,
    'diff',
    '--name-status',
    '--no-renames',
    `${base}...${ref}`,
  ])
  const merge: MergeKind =
    landed !== null || one.branch === null ? 'none' : await readMergeKind($, one.path, ref, base)
  return { committed: parseNameStatus(diff ?? ''), landed, landedOn, merge }
}

/** Reads every worktree of the repo at `dir` with its status; null outside a repo. */
export async function readOverview($: EngineInterface, dir: string): Promise<GitOverview | null> {
  const list = await gitOut($, dir, ['worktree', 'list', '--porcelain'])
  if (list === null) return null

  const listed = parseWorktreeList(list)
  const repo = listed[0]?.path ?? dir
  const sessionTop = await gitOut($, await $.session.cwd(), ['rev-parse', '--show-toplevel'])
  const base = await readBaseBranch($, repo)
  const remoteBase = base === null ? null : await readRemoteBase($, repo, base)

  const worktrees = await Promise.all(
    listed.map(async (one, index): Promise<Worktree> => {
      // Whole paths, one file a row, so each row can open that file's diff.
      const status = await gitOut($, one.path, [
        ...QUOTE_PATH_OFF,
        'status',
        '--porcelain=v1',
        '-b',
        '--no-renames',
        '--untracked-files=all',
      ])
      const state = status === null ? { ahead: 0, behind: 0, files: [] } : parseStatus(status)
      return {
        ...one,
        isCurrent: sessionTop !== null && samePath(one.path, sessionTop.trim()),
        isMain: index === 0,
        ...state,
        ...(await readLanding($, one, base, remoteBase)),
        activity: await readLastActivity($, one.path, state.files),
      }
    }),
  )

  const refs = await gitOut($, repo, [
    'for-each-ref',
    '--format=%(refname:short)%09%(upstream:track)',
    BRANCH_REF,
  ])
  const checkedOut = new Set(worktrees.map(w => w.branch))
  const otherBranches = parseBranches(refs ?? '').filter(b => !checkedOut.has(b.name))

  const behind =
    base === null || remoteBase === null
      ? null
      : await gitOut($, repo, ['rev-list', '--count', `${base}..${remoteBase}`])

  return {
    repo,
    base,
    baseBehind: Number(behind?.trim() ?? 0),
    worktrees,
    otherBranches,
    at: Date.now(),
  }
}

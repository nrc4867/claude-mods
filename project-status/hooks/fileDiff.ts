import type { EngineInterface } from 'claude-code'
import type { DiffBody, DiffSide, FileChange, Worktree } from '../types'
import { ACTION_TIMEOUT_MS } from './constants'
import { gitRun } from './gitRun'

/** Under what one drawing of `Code` takes, leaving room for the pane's other text. */
export const MAX_DIFF_CHARS = 90_000

const UNTRACKED = '??'
const NO_INDEX_DIFFERS = 1
const DIFF_FLAGS = ['--no-color', '--no-ext-diff', '--no-renames']

/** `Code` refuses every control character but tab and newline; CRLF files carry `\r`. */
export const stripControls = (text: string): string =>
  // eslint-disable-next-line no-control-regex
  text.replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g, '')

/** Reads a `git diff` of one file into whole hunks, as a cut hunk does not parse. */
export const parseDiff = (stdout: string, maxChars: number = MAX_DIFF_CHARS): DiffBody => {
  const text = stripControls(stdout)
  const first = text.startsWith('@@') ? 0 : text.indexOf('\n@@') + 1
  if (first === 0 && !text.startsWith('@@')) {
    return /^Binary files /m.test(text) ? { kind: 'binary' } : { kind: 'empty' }
  }

  const hunks = text.slice(first).split(/\n(?=@@ )/)
  const kept: string[] = []
  let used = 0
  for (const hunk of hunks) {
    if (used + hunk.length + 1 > maxChars) break
    kept.push(hunk)
    used += hunk.length + 1
  }
  if (kept.length === 0) return { kind: 'too-large' }
  return { kind: 'hunks', source: kept.join('\n'), shown: kept.length, total: hunks.length }
}

const diffArgs = (w: Worktree, base: string | null, side: DiffSide, file: FileChange): string[] => {
  if (side === 'committed') {
    const ref = w.branch ?? w.head
    return ['--literal-pathspecs', 'diff', ...DIFF_FLAGS, `${base}...${ref}`, '--', file.path]
  }
  if (file.code === UNTRACKED) {
    return ['diff', ...DIFF_FLAGS, '--no-index', '--', '/dev/null', file.path]
  }
  return ['--literal-pathspecs', 'diff', ...DIFF_FLAGS, 'HEAD', '--', file.path]
}

/** Reads one file's diff in its worktree: against the base, or its uncommitted change. */
export async function readFileDiff(
  $: EngineInterface,
  w: Worktree,
  base: string | null,
  side: DiffSide,
  file: FileChange,
): Promise<DiffBody> {
  const result = await gitRun($, w.path, diffArgs(w, base, side, file), ACTION_TIMEOUT_MS)
  const isOk =
    result !== null &&
    (result.exitCode === 0 || (file.code === UNTRACKED && result.exitCode === NO_INDEX_DIFFERS))
  return isOk ? parseDiff(result.stdout) : { kind: 'failed' }
}

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'
import type { DiffSide, FileChange, GitOverview, Worktree } from '../types'
import { diffView } from './diffView'
import { readFileDiff } from './fileDiff'
import { BRANCH_PANE_TITLE, REPO_ROW_PREFIX } from './constants'
import { samePath } from './formatUtils'
import { cleanupWorktree, fetchRemote, fillConflictPrompt, mergeWorktree } from './worktreeActions'
import { worktreeView } from './worktreeView'
import { readOverview } from './worktrees'

// Literals here so the engine can match the command and pane by name.
const COMMAND = 'worktrees'
const PANE_ID = 'worktrees'

const MERGE_ACTION = 'merge'
const CLEANUP_ACTION = 'cleanup'

const overview = atom({ plugin: 'worktrees', key: 'overview' } as const, null, {
  shape: 'overview-3',
})
const selected = atom({ plugin: 'worktrees', key: 'selected' } as const, null)
const repo = atom({ plugin: 'worktrees', key: 'repo' } as const, null)
const armed = atom({ plugin: 'worktrees', key: 'armed' } as const, null)
const notice = atom({ plugin: 'worktrees', key: 'notice' } as const, null)
const openDiff = atom({ plugin: 'worktrees', key: 'openDiff' } as const, null, {
  shape: 'diff-1',
})

const armKey = (action: string, path: string): string => `${action}:${path}`

const filesOf = (w: Worktree, side: DiffSide): FileChange[] =>
  side === 'committed' ? w.committed : w.files

const diffTitle = (side: DiffSide, base: string | null): string =>
  side === 'committed' ? `Against ${base}` : 'Uncommitted'

/** Reads the open diff again from a fresh overview; it closes when the file left its list. */
async function refreshOpenDiff($: EngineInterface, state: GitOverview | null): Promise<void> {
  const opened = await read($, openDiff)
  if (opened === null) return

  const w = state?.worktrees.find(one => samePath(one.path, opened.worktree))
  const file = w && filesOf(w, opened.side).find(f => f.path === opened.file.path)
  if (state === null || w === undefined || file === undefined) {
    await update($, openDiff, () => null)
    return
  }
  const body = await readFileDiff($, w, state.base, opened.side, file)
  await update($, openDiff, () => ({ ...opened, file, body }))
}

async function refresh($: EngineInterface): Promise<void> {
  const dir = (await read($, repo)) ?? (await $.session.cwd())
  const next = await readOverview($, dir)
  await update($, overview, () => next)
  await refreshOpenDiff($, next)
}

async function openFile(
  $: EngineInterface,
  w: Worktree,
  base: string | null,
  side: DiffSide,
  file: FileChange,
): Promise<void> {
  const body = await readFileDiff($, w, base, side, file)
  await update($, openDiff, () => ({
    worktree: w.path,
    file,
    side,
    title: diffTitle(side, base),
    body,
  }))
  await $.ui.scroll({ in: PANE_ID, to: 'start' })
}

/** Rereads the repo while the pane is open; a closed pane costs no git processes. */
export async function refreshPaneIfOpen($: EngineInterface): Promise<void> {
  try {
    const panes = await $.ui.panes()
    if (panes.some(p => p.id === PANE_ID)) await refresh($)
  } catch {
    // The pane keeps its last reading.
  }
}

/** Opens the pane on `path`, or on the session's repo; a tab behind another comes forward. */
export async function openBranchPane($: EngineInterface, path: string | null): Promise<void> {
  const panes = await $.ui.panes()
  if (panes.some(p => p.id === PANE_ID && !p.isShown)) await $.ui.close({ id: PANE_ID })
  await update($, repo, () => path)
  await update($, selected, () => null)
  await update($, openDiff, () => null)
  await update($, armed, () => null)
  await update($, notice, () => null)
  await $.ui.open({ id: PANE_ID, title: BRANCH_PANE_TITLE })
  await refresh($)
}

/** Runs an action, puts its outcome in the pane and rereads the repo. */
async function runAction(
  $: EngineInterface,
  working: string,
  work: () => Promise<string>,
): Promise<void> {
  await update($, armed, () => null)
  await update($, notice, () => ({ text: working, isError: false }))
  try {
    const text = await work()
    await update($, notice, () => ({ text, isError: false }))
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error)
    await update($, notice, () => ({ text, isError: true }))
  }
  await refresh($).catch(() => undefined)
}

/** The first press of a confirmed action arms it; true on the press that confirms. */
async function confirm($: EngineInterface, key: string): Promise<boolean> {
  if ((await read($, armed)) === key) return true
  await update($, armed, () => key)
  return false
}

async function pressMerge($: EngineInterface, root: string, w: Worktree): Promise<void> {
  if (w.merge === 'rebase' && !(await confirm($, armKey(MERGE_ACTION, w.path)))) return
  await runAction($, 'Merging…', () => mergeWorktree($, root, w.path))
}

async function pressCleanup($: EngineInterface, root: string, w: Worktree): Promise<void> {
  if (!(await confirm($, armKey(CLEANUP_ACTION, w.path)))) return
  await runAction($, 'Removing…', () => cleanupWorktree($, root, w.path))
}

export const registerBranchPane = (on: Parameters<Register>[0]): void => {
  on('command.run', { command: COMMAND }, async $ => {
    try {
      await openBranchPane($, null)
      return { text: 'Worktrees pane opened.' }
    } catch (error) {
      return { text: `Could not open the Worktrees pane: ${error instanceof Error ? error.message : String(error)}` }
    }
  })

  on('ui.press', { plugin: 'project-status', element: 'branch' }, async ($, e, next) => {
    await openBranchPane($, null)
    return next(e)
  })

  on('ui.press', { plugin: 'repo-dashboard' }, async ($, e, next) => {
    if (e.element.startsWith(REPO_ROW_PREFIX)) {
      await openBranchPane($, e.element.slice(REPO_ROW_PREFIX.length))
    }
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE_ID }, async ($, e) => {
    const { Box, Button, Code, Text } = $.ui.resolve(e)
    const opened = await read($, openDiff)
    if (opened !== null) {
      return diffView({ Box, Button, Code, Text }, opened, () => {
        void update($, openDiff, () => null)
      })
    }

    const state = await read($, overview)
    const picked = await read($, selected)
    const armedKey = await read($, armed)
    const lastNotice = await read($, notice)
    const onRefresh = () => void refresh($).catch(() => undefined)
    const onRepos = () => undefined

    if (state === null) {
      return (
        <Box flexDirection="row" gap={1}>
          <Text dimColor>Not a git repo.</Text>
          <Button key="repos" hotkey="p" label="Repos" onPress={onRepos} />
          <Button key="refresh" hotkey="r" label="Refresh" onPress={onRefresh} />
        </Box>
      )
    }

    const shown =
      state.worktrees.find(w => picked !== null && samePath(w.path, picked)) ??
      state.worktrees.find(w => w.isCurrent) ??
      state.worktrees[0]

    return worktreeView(
      { Box, Button, Text },
      {
        state,
        shown,
        isMergeArmed: shown !== undefined && armedKey === armKey(MERGE_ACTION, shown.path),
        isCleanupArmed: shown !== undefined && armedKey === armKey(CLEANUP_ACTION, shown.path),
        notice: lastNotice,
      },
      {
        refresh: onRefresh,
        repos: onRepos,
        fetch: () =>
          void runAction($, 'Fetching…', () => fetchRemote($, state.repo)).catch(() => undefined),
        select: path => {
          void update($, armed, () => null)
          void update($, selected, () => path)
        },
        merge: w => void pressMerge($, state.repo, w).catch(() => undefined),
        openFile: (w, side, file) =>
          void openFile($, w, state.base, side, file).catch(() => undefined),
        cleanup: w => void pressCleanup($, state.repo, w).catch(() => undefined),
        conflictPrompt: w =>
          void runAction($, 'Reading conflicts…', () =>
            fillConflictPrompt($, state.repo, w.path),
          ).catch(() => undefined),
      },
    )
  })
}

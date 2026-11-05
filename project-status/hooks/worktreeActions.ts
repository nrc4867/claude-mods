import type { EngineInterface } from 'claude-code'
import type { GitOverview, Worktree } from '../types'
import { ACTION_TIMEOUT_MS, REMOTE } from './constants'
import { basename, samePath } from './formatUtils'
import { gitRun } from './gitRun'
import { readConflictFiles } from './landing'
import { canMerge, cleanupBlockers, conflictPrompt } from './worktreeRules'
import { readOverview } from './worktrees'

/** Runs a git step that must succeed, failing with git's own words. */
async function step($: EngineInterface, cwd: string, args: string[]): Promise<void> {
  const result = await gitRun($, cwd, args, ACTION_TIMEOUT_MS)
  if (result === null) throw new Error(`git ${args[0]} did not finish`)
  if (result.exitCode !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || `git ${args[0]} failed`)
  }
}

/** Reads the repo again: a decision never rests on what the pane last drew. */
async function freshWorktree(
  $: EngineInterface,
  repo: string,
  path: string,
): Promise<{ state: GitOverview; worktree: Worktree }> {
  const state = await readOverview($, repo)
  const worktree = state?.worktrees.find(w => samePath(w.path, path))
  if (state === null || worktree === undefined) throw new Error(`${basename(path)} is gone`)
  return { state, worktree }
}

/** Removes a landed, clean worktree and its branch, with no force on the removal. */
export async function cleanupWorktree(
  $: EngineInterface,
  repo: string,
  path: string,
): Promise<string> {
  const { state, worktree } = await freshWorktree($, repo, path)
  const blockers = cleanupBlockers(worktree)
  if (blockers.length > 0) throw new Error(`Not removed: ${blockers.join(', ')}`)

  await step($, state.repo, ['worktree', 'remove', worktree.path])
  if (worktree.branch === null) return `Removed ${basename(worktree.path)}`

  // -D as a squashed branch is no ancestor of the base; landing was checked above.
  await step($, state.repo, ['branch', '-D', worktree.branch])
  return `Removed ${basename(worktree.path)} and ${worktree.branch}`
}

/** Moves the base branch up to `branch` by fast-forward alone. */
async function fastForward(
  $: EngineInterface,
  state: GitOverview,
  base: string,
  branch: string,
): Promise<void> {
  const holder = state.worktrees.find(w => w.branch === base)
  if (holder !== undefined) {
    await step($, holder.path, ['merge', '--ff-only', branch])
    return
  }
  // A refspec without `+` updates the unchecked-out branch only by fast-forward.
  await step($, state.repo, ['fetch', '.', `${branch}:${base}`])
}

/** Fast-forwards the base to the worktree's branch, rebasing first when it has diverged. */
export async function mergeWorktree(
  $: EngineInterface,
  repo: string,
  path: string,
): Promise<string> {
  const { state, worktree } = await freshWorktree($, repo, path)
  const { base } = state
  const { branch } = worktree
  if (base === null || branch === null || !canMerge(worktree)) {
    throw new Error(`Not merged: ${basename(path)} is ${worktree.merge}`)
  }

  if (worktree.merge === 'rebase') {
    try {
      await step($, worktree.path, ['rebase', base])
    } catch (error) {
      await gitRun($, worktree.path, ['rebase', '--abort'], ACTION_TIMEOUT_MS)
      throw error
    }
  }
  await fastForward($, state, base, branch)
  return `${base} fast-forwarded to ${branch}`
}

/** Adds a request to resolve the worktree's conflicts to the prompt box, unsent. */
export async function fillConflictPrompt(
  $: EngineInterface,
  repo: string,
  path: string,
): Promise<string> {
  const { state, worktree } = await freshWorktree($, repo, path)
  const { base } = state
  if (base === null || worktree.branch === null || worktree.merge !== 'conflicts') {
    throw new Error(`${basename(path)} no longer conflicts`)
  }

  const files = await readConflictFiles($, worktree.path, worktree.branch, base)
  const filled = await $.prompt.fill({
    text: conflictPrompt(worktree, base, files),
    mode: 'append',
  })
  if (!filled.isFilled) throw new Error('The prompt box did not take the text')
  return 'Conflicts added to the prompt'
}

export async function fetchRemote($: EngineInterface, repo: string): Promise<string> {
  await step($, repo, ['fetch', REMOTE, '--prune'])
  return `Fetched ${REMOTE}`
}

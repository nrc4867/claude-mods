import type { LandingState, Worktree } from '../types'

/** What stops safe cleanup of a worktree; empty when it may go. */
export const cleanupBlockers = (w: Worktree): string[] => [
  ...(w.isMain ? ['main worktree'] : []),
  ...(w.isCurrent ? ['session is here'] : []),
  ...(w.files.length > 0 ? ['uncommitted changes'] : []),
  ...(w.landed === null ? ['not landed'] : []),
]

/** A rebase rewrites the worktree's files, so uncommitted changes rule it out. */
export const isMergeBlockedByChanges = (w: Worktree): boolean =>
  w.merge === 'rebase' && w.files.length > 0

export const canMerge = (w: Worktree): boolean =>
  w.branch !== null && (w.merge === 'ff' || w.merge === 'rebase') && !isMergeBlockedByChanges(w)

/** The draft asking for a worktree's conflicts with the base branch to be resolved. */
export const conflictPrompt = (w: Worktree, base: string, files: string[]): string =>
  [
    `Resolve the merge conflicts between \`${w.branch}\` and \`${base}\`.`,
    '',
    `Worktree: ${w.path}`,
    'Conflicting files:',
    ...files.map(f => `- ${f}`),
    '',
    `Rebase \`${w.branch}\` onto \`${base}\` in that worktree and resolve the conflicts, keeping the intent of both sides. Don't merge into \`${base}\`.`,
  ].join('\n')

/** A worktree has landed only once its commits have and nothing is left uncommitted. */
export const landingState = (w: Worktree): LandingState => {
  if (w.landed === null) return 'not-landed'
  return w.files.length > 0 ? 'uncommitted' : 'landed'
}

export const describeLanding = (w: Worktree): string => {
  const state = landingState(w)
  if (state === 'not-landed') return 'Not landed'
  if (state === 'uncommitted') {
    const count = w.files.length
    return `Commits landed in ${w.landedOn}, but ${count} uncommitted ${count === 1 ? 'file has' : 'files have'} not`
  }
  if (w.landed === 'merged') return `Landed: merged in ${w.landedOn}`
  if (w.landed === 'patches') return `Landed: same patches in ${w.landedOn}`
  return `Landed: all changes in ${w.landedOn}`
}

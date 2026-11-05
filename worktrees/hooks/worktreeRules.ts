import type { LandedHow, Worktree } from '../types'

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

export const describeLanded =(how: LandedHow, on: string | null): string => {
  if (how === 'merged') return `Landed: merged in ${on}`
  if (how === 'patches') return `Landed: same patches in ${on}`
  if (how === 'content') return `Landed: all changes in ${on}`
  return 'Not landed'
}

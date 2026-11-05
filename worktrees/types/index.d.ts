export type FileChange = {
  /** The porcelain status code: ` M`, `A `, `??`. */
  code: string
  path: string
}

/** How a branch's work reached a target; null when it has not. */
export type LandedHow = 'merged' | 'patches' | 'content' | null

/** What merging into the base branch would take. */
export type MergeKind = 'none' | 'ff' | 'rebase' | 'conflicts' | 'unknown'

/** The newest work seen in a worktree. */
export type LastActivity = {
  /** Epoch ms. */
  at: number
  /** `commit` when HEAD's commit is newest; `edit` when an uncommitted file is. */
  kind: 'commit' | 'edit'
}

export type Worktree = {
  path: string
  head: string
  /** Null on a detached HEAD. */
  branch: string | null
  /** True for the worktree the session runs in. */
  isCurrent: boolean
  /** True for the repo's main worktree, which cleanup never removes. */
  isMain: boolean
  ahead: number
  behind: number
  /** Uncommitted changes, untracked files included. */
  files: FileChange[]
  /** Files the branch changes since it forked from the base branch. */
  committed: FileChange[]
  landed: LandedHow
  /** The ref `landed` was found on. */
  landedOn: string | null
  merge: MergeKind
  /** Null when neither a commit time nor a file time could be read. */
  activity: LastActivity | null
}

export type LocalBranch = {
  name: string
  ahead: number
  behind: number
}

export type GitOverview = {
  /** The main worktree's path. */
  repo: string
  /** The branch work lands on; null when the repo has none it recognizes. */
  base: string | null
  /** Commits `origin/<base>` has that the local base lacks. */
  baseBehind: number
  worktrees: Worktree[]
  /** Local branches no worktree has checked out. */
  otherBranches: LocalBranch[]
  /** Epoch ms the read finished. */
  at: number
}

/** Which comparison a file's diff comes from. */
export type DiffSide = 'committed' | 'uncommitted'

export type DiffBody =
  | {
      kind: 'hunks'
      /** Whole unified-diff hunks. */
      source: string
      shown: number
      total: number
    }
  | { kind: 'binary' | 'empty' | 'too-large' | 'failed' }

export type OpenDiff = {
  /** The worktree's path. */
  worktree: string
  file: FileChange
  side: DiffSide
  /** What the diff compares: `Against master`, `Uncommitted`. */
  title: string
  body: DiffBody
}

export type Notice = {
  text: string
  isError: boolean
}

declare module 'claude-code' {
  interface PluginState {
    worktrees: {
      overview: Shaped<GitOverview | null>
      /** The worktree path whose details the pane shows; null for the current one. */
      selected: string | null
      /** The repo the pane reads; null for the session's. */
      repo: string | null
      /** The action waiting for its confirming press, as `<action>:<path>`. */
      armed: string | null
      /** The file diff the pane shows in place of its lists. */
      openDiff: Shaped<OpenDiff | null>
      /** The last action's outcome. */
      notice: Notice | null
    }
  }
}

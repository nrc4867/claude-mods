export type StatusBar = {
  project: string
  /** Null outside a git repo. */
  branch: string | null
  /** Null until the first context reading. */
  context: string | null
}

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

export type NoteImage = {
  /** The PNG's name in the repo's notes images folder. */
  file: string
  width: number
  height: number
}

export type Note = {
  id: string
  /** Whole, newlines kept; empty on a note that is only pictures. */
  text: string
  images: NoteImage[]
  /** Epoch ms it was written. */
  at: number
  /** Epoch ms it was last put in the prompt; null while it waits. */
  addedAt: number | null
}

export type NotesRepo = {
  name: string
  /** The notes file's absolute path. */
  file: string
  /** The absolute path of the folder holding the notes' pictures. */
  imagesDir: string
}

export type RepoChoice = {
  name: string
  path: string
}

export type NotesModel = {
  /** Null until a repo is known. */
  repo: NotesRepo | null
  notes: Note[]
  /** Pictures pasted for the note being written. */
  pending: NoteImage[]
  /** True when the file holds something other than notes. */
  isUnreadable: boolean
  /** Epoch ms of the read; note ages count from here. */
  at: number
}

declare module 'claude-code' {
  interface PluginState {
    'project-status': {
      bar: Shaped<StatusBar | null>
      /** Tool calls made this session, subagents' included. */
      toolCount: number
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
      notesModel: Shaped<NotesModel | null>
      /** A folder in the repo notes were picked for; null for the session's. */
      notesRepo: string | null
      /** The repos on offer while the picker shows; null otherwise. */
      notesChoices: RepoChoice[] | null
      /** The field's text. */
      notesDraft: string
      /** The note the field is editing; null when it adds a new one. */
      notesEditing: string | null
      /** The note id or action waiting for its confirming press. */
      notesArmed: string | null
      notesNotice: Notice | null
    }
  }
}

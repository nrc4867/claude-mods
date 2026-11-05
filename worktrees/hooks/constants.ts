export const GIT_TIMEOUT_MS = 5000
/** Merges, rebases, removals and fetches touch files or the network. */
export const ACTION_TIMEOUT_MS = 60_000

/** repo-dashboard keys each repo row `repo:<path>`. */
export const REPO_ROW_PREFIX = 'repo:'

export const BRANCH_PANE_TITLE = 'Worktrees'
/** A Bash command matching this may have changed the repo's state. */
export const GIT_COMMAND_PATTERN = /\bgit\b/

/** Uncommitted files checked for their time, so a huge untracked folder stays cheap. */
export const MAX_ACTIVITY_FILES = 200

export const REMOTE = 'origin'
/** Tried in order when the remote names no default branch. */
export const BASE_BRANCHES = ['master', 'main']

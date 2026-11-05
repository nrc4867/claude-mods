export const PANE_TITLE = 'Repos'
export const GIT_TIMEOUT_MS = 5000

/** A Bash command matching this may have changed repo state. */
export const GIT_COMMAND_PATTERN = /\bgit\b/

export const NAME_COLUMNS = 22
export const MARKER_COLUMNS = 2
/** project-status reads a row's key to open its Worktrees pane on that repo. */
export const REPO_ROW_PREFIX = 'repo:'
/** Rows the pane keeps for its header. */
export const CHROME_ROWS = 2

export const GIT_TIMEOUT_MS = 5000
/** Merges, rebases, removals and fetches touch files or the network. */
export const ACTION_TIMEOUT_MS = 60_000
export const BRANCH_ICON = '⎇'
export const SEPARATOR = ' · '

/** The bar's links item shows what session-files publishes for this command. */
export const LINKS_COMMAND = 'links'
export const LINKS_LABEL = 'links'
export const NOTES_LABEL = 'notes'
/** Before a command item's key, so it cannot take a built-in's. */
export const COMMAND_ITEM_PREFIX = 'item:'
export const BAR_PANE_TITLE = 'Status bar'
/** `$.store` key holding the bar's items. */
export const BAR_ITEMS_STORE_KEY = 'bar-items'
/** The `$.state` key a mod writes to publish to the bar. */
export const STATUS_BAR_STATE_KEY = 'statusBar'
export const PUBLISHED_TEXT_MAX = 40
export const NOTES_PANE_TITLE = 'Notes'
/** Kept in the repo's shared git folder: every worktree reads it and git never tracks it. */
export const NOTES_FILE_NAME = 'claude-project-notes.json'
/** `$.store` key before a session root, holding the repo last picked from it. */
export const NOTES_STORE_PREFIX = 'notes-repo:'
/** `$.store` key before a repo's images folder, holding the pictures pasted for the next note. */
export const NOTES_PENDING_PREFIX = 'notes-pending:'
/** The engine draws this beside the field, so the pane's own hint carries the words. */
export const NOTES_FIELD_HINT = ''
export const NOTES_SAVE_HINT = '⏎ save'
export const NOTES_UPDATE_HINT = '⏎ update'
/** Beside the notes file, one PNG per pasted picture. */
export const NOTES_IMAGES_DIR = 'claude-project-notes-images'
export const NOTE_IMAGE_MAX_COLUMNS = 48
export const NOTE_IMAGE_MAX_ROWS = 16
export const NOTE_IMAGE_CELL_ASPECT = 2
/** PowerShell starts slowly and loads the clipboard's assemblies. */
export const POWERSHELL_TIMEOUT_MS = 15_000
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

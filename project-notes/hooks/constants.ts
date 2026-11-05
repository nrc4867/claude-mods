export const GIT_TIMEOUT_MS = 5000
export const NOTES_PANE_TITLE = 'Notes'
/** The command the status bar's notes item stands for. */
export const NOTES_COMMAND = 'notes'
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

import type { SectionId, SectionsOpen } from '../types'

export const PANE_TITLE = 'Session activity'

export const MAX_FILE_LINES = 300
export const NEAR_LIMIT_LINES = 250

/** Rows the pane keeps for its summary line. */
export const SUMMARY_ROWS = 1
export const MAX_TRACKED_FILES = 500
export const MAX_TRACKED_CALLS = 300
/** Characters of a tool call's summary kept in state. */
export const MAX_SUMMARY_CHARS = 200
/** Tools named in the Tools run header's busiest-tools list. */
export const TOP_TOOLS_SHOWN = 3
/** Columns of a Tools run row's tool-name cell. */
export const TOOL_NAME_COLUMNS = 12

export const SECTION_ORDER: readonly SectionId[] = ['written', 'read', 'tools']

export const SECTION_LABELS: Record<SectionId, string> = {
  written: 'Files written',
  read: 'Files read',
  tools: 'Tools run',
}

export const SECTION_EMPTY: Record<SectionId, string> = {
  written: 'No edits yet.',
  read: 'No reads yet.',
  tools: 'No tool calls yet.',
}

export const SECTIONS_DEFAULT: SectionsOpen = { written: true, read: true, tools: true }

export const GLYPH_OPEN = '▾'
export const GLYPH_CLOSED = '▸'

/** Tools whose successful call writes the file named by its input. */
export const WRITE_TOOLS: readonly string[] = ['Edit', 'Write', 'NotebookEdit']
/** Built-in tools whose successful call reads the file named by its input. */
export const READ_TOOLS: readonly string[] = ['Read']
/** MCP tools that read a file, matched by name (IntelliJ's read tools). */
export const MCP_READ_TOOL = /^mcp__.*intellij.*__(read_file|get_file_text_by_path)$/i

/** Input fields that name a file, in the order they are tried. */
export const PATH_FIELDS: readonly string[] = ['file_path', 'notebook_path', 'pathInProjectRoot', 'path']

/**
 * Input fields tried, in order, for a call's one-line summary when its tool
 * has no rule of its own in `toolSummary.ts`.
 */
export const SUMMARY_FIELDS: readonly string[] = [
  'command', 'file_path', 'notebook_path', 'pathInProjectRoot', 'path', 'pattern',
  'query', 'url', 'description', 'skill', 'prompt', 'name',
]

/**
 * The command a row's click runs, the file's absolute path appended. The
 * JetBrains Toolbox `idea` script opens it in the running IntelliJ; `cmd /c`
 * because the script is a .cmd and processes start without a shell.
 */
export const EDITOR_ARGV: readonly string[] = ['cmd', '/c', 'idea']
export const EDITOR_TIMEOUT_MS = 15_000
export const EDITOR_LINE_FLAG = '--line'
/** `cmd /c` would read these in a path as shell syntax. */
export const CMD_UNSAFE_PATH = /[&|<>^"%!]/

export const LINKS_PANE_TITLE = 'Links'
/** Where Git for Windows puts the shell; System32's `bash` on PATH is WSL's. */
export const GIT_BASH_PATH = 'C:/Program Files/Git/bin/bash.exe'
export const FALLBACK_SHELL = 'bash'
export const SHELL_COMMAND_FLAG = '-c'
export const MAX_COMMAND_CHARS = 4000
export const MAX_COMMAND_OUTPUT_CHARS = 20_000
export const COMMAND_OUTPUT_LINES = 15
export const COMMAND_OUTPUT_FLUSH_MS = 200
export const MAX_LINKS = 200
export const MAX_LINK_NOTE_CHARS = 200
/** A `Link` refuses an `href` past 2048 characters once encoded. */
export const MAX_URL_CHARS = 1500
/** References read from one reply, so a long listing cannot start hundreds of file checks. */
export const MAX_MENTIONS_PER_REPLY = 30

/** The command the status bar's links item stands for. */
export const LINKS_COMMAND = 'links'

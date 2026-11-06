export const PANE_TITLE = 'Context'

export const LABEL_COLUMNS = 22
export const TOKEN_COLUMNS = 7
export const MIN_BAR_COLUMNS = 4
export const TOP_MEMORY_FILES = 5
export const TOP_MCP_SERVERS = 5

export const BAR_FULL = '█'
export const BAR_EMPTY = '░'
export const DEFAULT_ROW_COLOR = 'text'

export const RATE_LIMIT_LABELS: Readonly<Record<string, string>> = {
  five_hour: '5-hour',
  seven_day: 'Weekly',
  spend_limit: 'Spend limit',
}

/** Usage bars turn warning, then error, past these percentages. */
export const USAGE_WARN_PERCENT = 70
export const USAGE_ERROR_PERCENT = 90

/** Resets further away than this show a weekday as well as the time. */
export const SAME_DAY_MS = 20 * 60 * 60 * 1000

export const SHORT_SESSION_ID_CHARS = 8
export const RESUME_COMMAND = 'claude --resume'
export const DEFAULT_CONFIG_DIR_NAME = '.claude'
/** What the transcript folder's name replaces with `-` in the session root. */
export const PROJECT_DIR_UNSAFE = /[^a-zA-Z0-9]/g

export const PLAN_SPEND_LABEL = 'Monthly spend'
/** The plan's spend is asked for again once the last answer is this old. */
export const PLAN_SPEND_MAX_AGE_MS = 5 * 60 * 1000
export const PLAN_SPEND_TIMEOUT_MS = 30_000
export const PLAN_SPEND_REQUEST_ID = 'context-breakdown-usage'
/** A headless Claude Code that answers one control request, saves no session and starts no MCP server. */
export const PLAN_SPEND_ARGS: readonly string[] = [
  'claude',
  '-p',
  '--input-format',
  'stream-json',
  '--output-format',
  'stream-json',
  '--verbose',
  '--no-session-persistence',
  '--strict-mcp-config',
  '--disable-slash-commands',
]
export const DEFAULT_CURRENCY = 'USD'
export const DEFAULT_MINOR_DIGITS = 2
/** Amounts this large drop their cents to fit the figure column. */
export const WHOLE_UNITS_FROM = 1000

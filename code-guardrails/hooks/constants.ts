export const MAX_FILE_LINES = 300

/** Lines a file must grow past its last warning before it is flagged again. */
export const REWARN_STEP_LINES = 100

/** How many offending lines a history-comment note quotes. */
export const MAX_QUOTED_LINES = 5

export const CODE_EXTENSIONS: ReadonlySet<string> = new Set([
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'mts', 'cts',
  'kt', 'kts', 'java', 'go', 'rs', 'py', 'rb', 'cs',
  'c', 'cc', 'cpp', 'h', 'hpp', 'glsl', 'wgsl', 'slang', 'hlsl',
  'css', 'scss', 'vue', 'svelte',
])

/** Files where every line is prose, so the whole added text is checked. */
export const PROSE_EXTENSIONS: ReadonlySet<string> = new Set(['md', 'mdx', 'txt'])

/**
 * Phrases that narrate past behaviour. "used to" matches only outside the
 * passive "is used to <verb>", which describes current purpose.
 */
export const HISTORY_PATTERNS: readonly RegExp[] = [
  /(?<!\b(?:is|are|be|been|being|was|were|gets?|got)\s+)\bused to\b/i,
  /\bpreviously\b/i,
  /\bformerly\b/i,
  /\bno longer\b/i,
  /\bnow (?:uses|returns|calls|supports|handles|lives|takes|reads|writes)\b/i,
  /\b(?:changed|migrated|moved|renamed|switched) (?:over )?from\b/i,
  /\b(?:was|were|has been|have been) (?:replaced|removed|refactored)\b/i,
  /\bthe old (?:implementation|version|behaviou?r|approach|code|way)\b/i,
]

/** Comment openers across the languages in CODE_EXTENSIONS; group 1 is the comment text. */
export const COMMENT_PATTERN = /(?:\/\/|\/\*|^\s*\*|^\s*#|<!--|--\s)(.*)$/

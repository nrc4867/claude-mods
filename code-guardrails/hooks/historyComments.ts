import {
  CODE_EXTENSIONS,
  COMMENT_PATTERN,
  HISTORY_PATTERNS,
  MAX_QUOTED_LINES,
  PROSE_EXTENSIONS,
} from './constants'
import { extensionOf } from './pathUtils'

const proseOf = (line: string, isProse: boolean): string | undefined =>
  isProse ? line : COMMENT_PATTERN.exec(line)?.[1]

/** A note for the model listing added comment or doc lines that narrate code history. */
export const historyCommentNote = (filePath: string, added: string): string | undefined => {
  const ext = extensionOf(filePath)
  const isProse = PROSE_EXTENSIONS.has(ext)
  if (!isProse && !CODE_EXTENSIONS.has(ext)) return undefined

  const hits = added
    .split('\n')
    .filter(line => {
      const prose = proseOf(line, isProse)
      return prose !== undefined && HISTORY_PATTERNS.some(p => p.test(prose))
    })
    .map(line => line.trim())

  if (hits.length === 0) return undefined

  const quoted = hits.slice(0, MAX_QUOTED_LINES).map(l => `  ${l}`).join('\n')
  return `${filePath}: these added lines narrate what the code did before:\n${quoted}\n` +
    'The user wants comments and docs to state current behaviour only. Reword them, ' +
    'unless a line is about runtime state rather than code history.'
}

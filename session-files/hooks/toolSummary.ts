import { MAX_SUMMARY_CHARS, MCP_READ_TOOL, PATH_FIELDS, READ_TOOLS, SUMMARY_FIELDS, WRITE_TOOLS } from './constants'
import { firstString, oneLine } from './stringUtils'

export type ToolInput = Readonly<Record<string, unknown>>

/** `mcp__server__tool` as `server:tool`; a built-in's name as is. */
export const displayToolName = (tool: string): string => {
  const [, server, name] = /^mcp__(.+?)__(.+)$/.exec(tool) ?? []
  return server && name ? `${server.replace(/^(plugin_[^_]+_|claude_ai_)/, '')}:${name}` : tool
}

const withScope = (what: string | undefined, where: string | undefined): string | undefined =>
  what === undefined ? where : where === undefined ? what : `${what} in ${where}`

const byTool: Record<string, (input: ToolInput) => string | undefined> = {
  Grep: input => withScope(firstString(input, ['pattern']), firstString(input, ['path', 'glob'])),
  Glob: input => withScope(firstString(input, ['pattern']), firstString(input, ['path'])),
  Agent: input => withScope(firstString(input, ['description']), firstString(input, ['subagent_type'])),
}

/** One line naming what a call acts on: its command, path, pattern or query. */
export const summarizeCall = (tool: string, input: ToolInput): string =>
  oneLine(byTool[tool]?.(input) ?? firstString(input, SUMMARY_FIELDS) ?? '', MAX_SUMMARY_CHARS)

const pathOf = (input: ToolInput): string | undefined => firstString(input, PATH_FIELDS)

/** The file a call of `tool` writes, when it is a writing tool. */
export const writtenPath = (tool: string, input: ToolInput): string | undefined =>
  WRITE_TOOLS.includes(tool) ? pathOf(input) : undefined

/** The file a call of `tool` reads, when it is a reading tool. */
export const readPath = (tool: string, input: ToolInput): string | undefined =>
  READ_TOOLS.includes(tool) || MCP_READ_TOOL.test(tool) ? pathOf(input) : undefined

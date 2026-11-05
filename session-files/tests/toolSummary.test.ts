import { expect, test } from 'claude-code/testing'
import { displayToolName, readPath, summarizeCall, writtenPath } from '../hooks/toolSummary'

test('IntelliJ MCP reads count as file reads', async () => {
  expect(readPath('mcp__intellij__read_file', { pathInProjectRoot: 'src/b.ts' })).toBe('src/b.ts')
  expect(readPath('mcp__claude-artifacts__read_file', { path: 'x.css' })).toBe(undefined)
})

test('writes are Edit, Write and NotebookEdit only', async () => {
  expect(writtenPath('Edit', { file_path: '/a.ts' })).toBe('/a.ts')
  expect(writtenPath('NotebookEdit', { notebook_path: '/n.ipynb' })).toBe('/n.ipynb')
  expect(writtenPath('Read', { file_path: '/a.ts' })).toBe(undefined)
})

test('MCP tool names are shortened to server:tool', async () => {
  expect(displayToolName('mcp__intellij__read_file')).toBe('intellij:read_file')
  expect(displayToolName('mcp__plugin_context7_context7__query')).toBe('context7:query')
  expect(displayToolName('Bash')).toBe('Bash')
})

test('a summary is one line', async () => {
  expect(summarizeCall('Bash', { command: 'a\n  b' })).toBe('a b')
  expect(summarizeCall('Agent', { description: 'Find x', subagent_type: 'Explore' })).toBe('Find x in Explore')
})

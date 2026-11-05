import { expect, test } from 'claude-code/testing'
import { findMentions } from '../hooks/linkRules'

const PANE = {
  plugin: 'session-files',
  component: 'Pane',
  requestId: 'session-links',
  surface: 'terminal',
  props: {
    title: 'Links',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

const TOOL = 'mcp__session-files__link_for_user'
const PROCESS_OK = { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false }
const FILE_STAT = { kind: 'file', size: 1, mtimeMs: 0, isLink: false }
const OTHER_STAT = { kind: 'other', size: 0, mtimeMs: 0, isLink: false }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stubFiles = (on: any, existing: readonly string[]): void => {
  on('session.root', () => ({ value: '/proj' }))
  on('ui.panes', () => ({ value: [] }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('fs.stat', (_: unknown, e: { path: string }) => {
    // The engine resolves a path before the hook reads it: on Windows `/proj` arrives as `C:\proj`.
    const asGiven = e.path.replace(/^[A-Za-z]:/, '').replace(/\\/g, '/')
    return { value: existing.includes(asGiven) ? FILE_STAT : OTHER_STAT }
  })
}

test('a reply is read for URLs and file references, not hosts', () => {
  const { urls, files } = findMentions(
    'See https://example.com/a. and [spec](docs/spec.md) at `src/a.ts:12`, C:\\w\\b.ts:3, localhost:3000 maybe.',
  )
  const refs = files.map(f => `${f.path}|${f.line}`)
  expect(urls).toEqual(['https://example.com/a'])
  expect(refs).toContain('docs/spec.md|null')
  expect(refs).toContain('src/a.ts|12')
  expect(refs).toContain('C:\\w\\b.ts|3')
  expect(files.map(f => f.path)).not.toContain('localhost')
})

test('a flagged file is listed with its note and opens at its line', async ($, on) => {
  const ran: string[][] = []
  stubFiles(on, ['/proj/src/a.ts'])
  on('process.run', (_, e) => {
    ran.push([...e.argv])
    return { value: PROCESS_OK }
  })

  const done = await $.tool.call({ tool: TOOL, target: 'src/a.ts', line: 12, note: 'Is this\nthe right limit?' } as never)
  expect(done.isError).toBe(undefined)
  // A tool of an MCP shape answers with a string; the real engine refuses an object, this harness does not.
  expect(done.result).toBe('Linked src/a.ts:12 in the Links pane.')

  const ui = await $.ui.mount(PANE)
  expect((await ui.find({ type: 'Text', text: /right limit/ }))?.text?.trim()).toBe('Is this the right limit?')
  await ui.press({ key: 'open:file:/proj/src/a.ts:12' })
  expect(ran[0]?.slice(-3)).toEqual(['--line', '12', '/proj/src/a.ts'])
  await ui.unmount()
})

test('a target that is neither a file nor a URL is refused', async ($, on) => {
  stubFiles(on, [])
  const done = await $.tool.call({ tool: TOOL, target: 'missing.ts' } as never)
  expect(done.isError).toBe(true)

  const ui = await $.ui.mount(PANE)
  expect((await ui.find({ type: 'Text', text: /No links yet/ }))?.text).toBe('No links yet.')
  await ui.unmount()
})

test('a file whose name cmd would read as syntax is not handed to the editor', async ($, on) => {
  const ran: string[][] = []
  stubFiles(on, ['/proj/a&calc.ts'])
  on('ui.toast', () => ({ value: undefined }))
  on('process.run', (_, e) => {
    ran.push([...e.argv])
    return { value: PROCESS_OK }
  })

  await $.tool.call({ tool: TOOL, target: 'a&calc.ts' } as never)
  const ui = await $.ui.mount(PANE)
  await ui.press({ key: 'open:file:/proj/a&calc.ts:' })
  expect(ran).toEqual([])
  await ui.unmount()
})

test('a reply adds its real files and URLs; a mention leaves a flag as it was', async ($, on) => {
  stubFiles(on, ['/proj/src/a.ts'])

  await $.tool.call({ tool: TOOL, target: 'src/a.ts', line: 3, note: 'Check this' } as never)
  await $.session.append({
    message: {
      type: 'assistant',
      role: 'assistant',
      content: [{ type: 'text', text: 'Done in src/a.ts:3 and src/gone.ts:9, see https://example.com/r' }],
    },
    door: 'response',
    origin: { kind: 'model', model: 'test' },
    uuid: 'row-1',
  } as never)

  const ui = await $.ui.mount(PANE)
  expect((await ui.find({ type: 'Text', text: /Check this/ }))?.text?.trim()).toBe('Check this')
  expect((await ui.find({ type: 'Text', text: /To look at/ }))?.text).toContain('(1)')
  expect((await ui.find({ type: 'Text', text: /Mentioned/ }))?.text).toContain('(1)')
  expect(await ui.find({ key: 'open:file:/proj/src/gone.ts:9' })).toBe(undefined)
  await ui.unmount()
})

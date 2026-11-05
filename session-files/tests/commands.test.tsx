import { expect, test } from 'claude-code/testing'
import { cleanOutput, commandLinkId, commandProblem, lastLines } from '../hooks/commandRules'

const PANE = {
  plugin: 'session-files',
  component: 'Pane',
  requestId: 'session-links',
  surface: 'terminal',
  props: {
    title: 'Links',
    isFocused: false,
    bodyColumns: 80,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

const TOOL = 'mcp__session-files__command_for_user'
const GRADLE = 'cd app && ./gradlew :core:test'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stubSession = (on: any): void => {
  on('session.root', () => ({ value: '/proj' }))
  on('ui.panes', () => ({ value: [] }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('env.get', () => ({ value: undefined }))
  on('fs.stat', (_: unknown, e: { path: string }) => {
    const isGitBash = e.path.includes('Git')
    return { value: { kind: isGitBash ? 'file' : 'dir', size: 0, mtimeMs: 0, isLink: false } }
  })
}

const ID = commandLinkId('/proj', GRADLE)

/** The run settles behind the press; each find yields to it. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const waitForText = async (ui: any, text: RegExp): Promise<string | undefined> => {
  for (let i = 0; i < 500; i++) {
    const found = await ui.find({ type: 'Text', text })
    if (found !== undefined) return found.text as string
  }
  return undefined
}

test('output is made drawable and commands with hidden characters are refused', () => {
  expect(cleanOutput('\u001b[32mBUILD\u001b[0m ok\r\nline\u0007')).toBe('BUILD ok\nline')
  expect(lastLines('a\nb\nc\n', 2)).toBe('b\nc')
  expect(commandProblem(GRADLE)).toBe(null)
  expect(commandProblem('rm x\u202e')).not.toBe(null)
  expect(commandProblem('rm\u001b[2K x')).not.toBe(null)
  expect(commandProblem('')).not.toBe(null)
})

test('an attached command does nothing until Run is confirmed, then shows its output', async ($, on) => {
  const spawned: { argv: readonly string[]; cwd?: string }[] = []
  stubSession(on)
  on('process.spawn', async function* (_, e) {
    spawned.push({ argv: e.argv, cwd: e.cwd })
    yield { stream: 'stdout', text: 'BUILD SUCCESSFUL\n' }
    return { value: { code: 0, signal: null } }
  })

  const done = await $.tool.call({ tool: TOOL, command: GRADLE, note: 'Watch the core tests' } as never)
  expect(done.isError).toBe(undefined)
  expect(typeof done.result).toBe('string')

  const ui = await $.ui.mount(PANE)
  expect((await ui.find({ type: 'Text', text: /gradlew/ }))?.text).toBe(`$ ${GRADLE}`)
  expect((await ui.find({ type: 'Text', text: /Watch the core/ }))?.text?.trim()).toBe('Watch the core tests')

  await ui.press({ key: `run:${ID}` })
  expect(spawned).toEqual([])

  await ui.press({ key: `confirm:${ID}` })
  expect(spawned[0]?.argv.slice(1)).toEqual(['-c', GRADLE])
  expect(spawned[0]?.argv[0]).toContain('Git/bin/bash.exe')
  expect(await waitForText(ui, /BUILD SUCCESSFUL/)).toBe('BUILD SUCCESSFUL')
  expect(await waitForText(ui, /done/)).toContain('done')
  await ui.unmount()
})

test('Cancel takes the confirm back', async ($, on) => {
  const spawned: unknown[] = []
  stubSession(on)
  on('process.spawn', async function* (_, e) {
    spawned.push(e.argv)
    return { value: { code: 0, signal: null } }
  })

  await $.tool.call({ tool: TOOL, command: GRADLE } as never)
  const ui = await $.ui.mount(PANE)
  await ui.press({ key: `run:${ID}` })
  await ui.press({ key: `cancel:${ID}` })
  expect(await ui.find({ key: `confirm:${ID}` })).toBe(undefined)
  expect(spawned).toEqual([])
  await ui.unmount()
})

test('a failing command shows its exit code', async ($, on) => {
  stubSession(on)
  on('process.spawn', async function* () {
    yield { stream: 'stderr', text: 'FAILURE\n' }
    return { value: { code: 1, signal: null } }
  })

  await $.tool.call({ tool: TOOL, command: GRADLE } as never)
  const ui = await $.ui.mount(PANE)
  await ui.press({ key: `run:${ID}` })
  await ui.press({ key: `confirm:${ID}` })
  expect(await waitForText(ui, /exit 1/)).toContain('failed (exit 1)')
  await ui.unmount()
})

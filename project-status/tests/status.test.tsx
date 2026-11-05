import { expect, test } from 'claude-code/testing'

const ROW = {
  plugin: 'project-status',
  component: 'PromptHint',
  requestId: 'hint',
  surface: 'terminal',
  props: { isDraft: false, isWorking: false, hint: '? for shortcuts' },
} as const

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stubEngine = (on: any): void => {
  on('session.root', () => ({ value: 'C:/ws/app' }))
  on('session.cwd', () => ({ value: 'C:/ws/app' }))
  on('session.usage', () => ({
    value: { context: { tokens: 50_000, window: 600_000, percent: 8 } },
  }))
  on('process.run', () => ({ value: { exitCode: 0, stdout: 'main\n', stderr: '' } }))
  on('command.register', () => ({ value: { command: 'statusbar' } }))
  on('session.start', (_: unknown, e: any) => ({ cwd: e.cwd }))
  on('ui.render', { component: 'PromptHint' }, ($: any, e: any) => {
    const { Text } = $.ui.resolve(e)
    return <Text>{e.props.hint}</Text>
  })
}

test('the row under the prompt draws each item as a button beside the engine hint', async ($, on) => {
  stubEngine(on)
  await $.session.start({ cwd: 'C:/ws/app', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount(ROW)
  expect((await ui.find({ key: 'project' }))?.text).toBe('app')
  expect((await ui.find({ key: 'branch' }))?.text).toBe('⎇ main')
  expect((await ui.find({ key: 'context' }))?.text).toBe('ctx 8% (50k/600k)')
  expect((await ui.find({ key: 'tools' }))?.text).toBe('0 tools')
  expect((await ui.find({ key: 'links' }))?.text).toBe('links')
  expect((await ui.find({ key: 'notes' }))?.text).toBe('notes')
  expect((await ui.find({ type: 'Text', text: /shortcuts/ }))?.text).toBe('? for shortcuts')
  await ui.unmount()
})

test('the tools item counts every tool call', async ($, on) => {
  stubEngine(on)
  on('tool.call', () => ({ result: {} }))
  await $.session.start({ cwd: 'C:/ws/app', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'Read', file_path: 'a.ts' })

  const ui = await $.ui.mount(ROW)
  expect((await ui.find({ key: 'tools' }))?.text).toBe('1 tool')
  await $.tool.call({ tool: 'Read', file_path: 'b.ts' })
  expect((await ui.find({ key: 'tools' }))?.text).toBe('2 tools')
  await ui.unmount()
})

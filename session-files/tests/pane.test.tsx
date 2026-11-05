import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'session-files',
  component: 'Pane',
  requestId: 'session-files',
  props: {
    title: 'Session activity',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

const PROCESS_OK = { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false }

test('an edited file over 300 lines is listed with its count', async ($, on) => {
  on('session.root', () => ({ value: '/proj' }))
  on('fs.read', () => ({ value: 'x\n'.repeat(320) }))
  on('tool.call', () => ({ result: {} }))

  await $.tool.call({ tool: 'Write', file_path: '/proj/src/big.ts', content: 'x' })
  await $.tool.call({ tool: 'Write', file_path: '/proj/src/big.ts', content: 'x' })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /src\/big\.ts/ }))?.text).toBe('src/big.ts')
    expect((await ui.find({ type: 'Text', text: /^\s*320$/ }))?.text?.trim()).toBe('320')
    expect((await ui.find({ type: 'Text', text: /×2/ }))?.text?.trim()).toBe('×2')
    await ui.unmount()
  }
})

test('a read file is listed under Files read with its read count', async ($, on) => {
  on('session.root', () => ({ value: '/proj' }))
  on('tool.call', () => ({ result: {} }))

  await $.tool.call({ tool: 'Read', file_path: '/proj/src/a.ts' })
  await $.tool.call({ tool: 'Read', file_path: '/proj/src/a.ts' })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /^src\/a\.ts$/ }))?.text).toBe('src/a.ts')
  expect(await ui.find({ type: 'Text', text: /No reads yet/ })).toBe(undefined)
  await ui.unmount()
})

test('tool calls are listed with what they acted on, failures marked', async ($, on) => {
  on('session.root', () => ({ value: '/proj' }))
  on('tool.call', (_, e) => (e.tool === 'Bash' ? { result: {}, isError: true } : { result: {} }))

  await $.tool.call({ tool: 'Bash', command: 'npm test\n  --watch' })
  await $.tool.call({ tool: 'Grep', pattern: 'TODO', path: 'src' })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /^npm test/ }))?.text).toBe('npm test --watch')
  expect((await ui.find({ type: 'Text', text: /^TODO/ }))?.text).toBe('TODO in src')
  expect((await ui.find({ type: 'Text', text: /^✗$/ }))?.text).toBe('✗')
  await ui.unmount()
})

test('pressing a section header collapses and expands it', async ($, on) => {
  on('session.root', () => ({ value: '/proj' }))
  on('tool.call', () => ({ result: {} }))

  await $.tool.call({ tool: 'Read', file_path: '/proj/src/a.ts' })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /^src\/a\.ts$/ }))?.text).toBe('src/a.ts')
  await ui.press({ key: 'toggle:read' })
  expect(await ui.find({ type: 'Text', text: /^src\/a\.ts$/ })).toBe(undefined)
  await ui.press({ key: 'toggle:read' })
  expect((await ui.find({ type: 'Text', text: /^src\/a\.ts$/ }))?.text).toBe('src/a.ts')
  await ui.unmount()
})

test('clicking a row opens that file in the editor', async ($, on) => {
  const ran: string[][] = []
  on('session.root', () => ({ value: '/proj' }))
  on('fs.read', () => ({ value: 'x\n' }))
  on('tool.call', () => ({ result: {} }))
  on('process.run', (_, e) => {
    ran.push([...e.argv])
    return { value: PROCESS_OK }
  })

  await $.tool.call({ tool: 'Write', file_path: '/proj/src/a.ts', content: 'x' })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    await ui.press({ key: 'open:src/a.ts' })
    await ui.unmount()
  }

  expect(ran).toEqual([
    ['cmd', '/c', 'idea', '/proj/src/a.ts'],
    ['cmd', '/c', 'idea', '/proj/src/a.ts'],
  ])
})

test('an empty session says so in each section', async $ => {
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /No edits/ }))?.text?.trim()).toBe('No edits yet.')
  expect((await ui.find({ type: 'Text', text: /No reads/ }))?.text?.trim()).toBe('No reads yet.')
  expect((await ui.find({ type: 'Text', text: /No tool calls/ }))?.text?.trim()).toBe('No tool calls yet.')
  await ui.unmount()
})

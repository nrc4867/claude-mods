import { expect, test } from 'claude-code/testing'
import {
  commandItem,
  defaultItems,
  findPublished,
  itemKey,
  moveItem,
  normalizeItems,
  parseCommandLine,
  readPublishedItems,
  removeItem,
} from '../hooks/bar/barRules'

const PLUGIN = 'project-status'
const STORE_KEY = 'bar-items'
const ROW = {
  plugin: PLUGIN,
  component: 'PromptHint',
  requestId: 'hint',
  surface: 'terminal',
  props: { isDraft: false, isWorking: false, hint: '? for shortcuts' },
} as const
const PANE = {
  plugin: PLUGIN,
  component: 'Pane',
  requestId: 'project-status-bar',
  surface: 'terminal',
  props: {
    title: 'Status bar',
    isFocused: true,
    bodyColumns: 80,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const
const DEPLOY = { kind: 'command', title: 'deploy', command: 'deploy', args: 'staging', isHidden: false }
const DEPLOY_KEY = 'item:command:deploy staging'

const ALL_COMMANDS = ['repos', 'worktrees', 'ctx', 'files', 'links', 'notes', 'statusbar', 'deploy']

type World = { store: Map<string, unknown>; ran: unknown[]; openError: string | null; opened: string[]; commands: string[] }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stubEngine = (on: any): World => {
  const world: World = { store: new Map(), ran: [], openError: null, opened: [], commands: [...ALL_COMMANDS] }
  on('session.root', () => ({ value: 'C:/ws/app' }))
  on('session.cwd', () => ({ value: 'C:/ws/app' }))
  on('session.usage', () => ({ value: { context: { tokens: 50_000, window: 600_000, percent: 8 } } }))
  on('process.run', () => ({ value: { exitCode: 128, stdout: '', stderr: '' } }))
  on('fs.exists', () => ({ value: false }))
  on('store.get', (_: unknown, e: any) => ({ value: world.store.get(e.key) }))
  on('store.set', (_: unknown, e: any) => {
    world.store.set(e.key, e.value)
    return { value: undefined }
  })
  on('ui.panes', () => ({ value: [] }))
  on('ui.open', (_: unknown, e: any) => {
    if (world.openError !== null) throw new Error(world.openError)
    world.opened.push(e.id)
    return { value: { isPlaced: true } }
  })
  on('command.register', () => ({ value: { command: 'x' } }))
  on('command.list', () => ({
    value: world.commands.map(name => ({ name, description: name, source: 'plugin' })),
  }))
  on('command.run', (_: unknown, e: any) => {
    world.ran.push({ command: e.command, args: e.args })
    return { text: 'ran' }
  })
  on('session.start', (_: unknown, e: any) => ({ cwd: e.cwd }))
  on('ui.render', { component: 'PromptHint' }, ($: any, e: any) => {
    const { Text } = $.ui.resolve(e)
    return <Text>{e.props.hint}</Text>
  })
  return world
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const start = ($: any) => $.session.start({ cwd: 'C:/ws/app', surface: 'terminal', isInteractive: true })

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const runCommand = ($: any, command: string, args = '') => $.command.run({ command, args })

/** Another mod, loaded apart from this file: `/publish <json>` writes the JSON as its `statusBar`. */
const OTHER_MOD = {
  name: 'other-mod',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: (on: any) => {
    on('command.run', { command: 'publish' }, async ($: any, e: any) => {
      await $.state.set({ plugin: 'other-mod', key: 'statusBar' }, JSON.parse(e.args))
      return { text: 'published' }
    })
  },
}

test('a stored list is made whole, and items move within bounds', () => {
  const items = normalizeItems([DEPLOY, DEPLOY, { kind: 'builtin', id: 'notes' }, { kind: 'nonsense' }, 5])
  expect(items.map(itemKey)).toEqual([
    'command:deploy staging',
    'notes',
    'project',
    'branch',
    'context',
    'tools',
    'links',
  ])
  expect(normalizeItems('garbage').map(itemKey)).toEqual(defaultItems().map(itemKey))

  const defaults = defaultItems()
  expect(moveItem(defaults, 'branch', -1).map(itemKey).slice(0, 2)).toEqual(['branch', 'project'])
  expect(moveItem(defaults, 'project', -1)).toEqual(defaults)
  expect(moveItem(defaults, 'notes', 1)).toEqual(defaults)
  expect(removeItem(defaults, 'project')).toEqual(defaults)
})

test('a command line and a title are read as typed', () => {
  expect(parseCommandLine('/deploy staging now ')).toEqual({ command: 'deploy', args: 'staging now' })
  expect(parseCommandLine('deploy')).toEqual({ command: 'deploy', args: '' })
  expect(parseCommandLine('   ')).toBe(null)
  expect(commandItem('  ', 'deploy', '')).toEqual({
    kind: 'command',
    title: 'deploy',
    command: 'deploy',
    args: '',
    isHidden: false,
  })
})

test('what a mod publishes is held to the format', () => {
  expect(
    readPublishedItems({
      '/good': { text: ' 2 running\n', color: 'warning' },
      plain: { text: 'ok', color: 'chartreuse' },
      empty: { text: '  ' },
      wrong: { text: 3 },
      long: { text: 'x'.repeat(100) },
    }),
  ).toEqual({
    good: { text: '2 running', color: 'warning' },
    plain: { text: 'ok' },
    long: { text: 'x'.repeat(40) },
  })
  expect(readPublishedItems('nope')).toEqual({})
  expect(findPublished({ a: {}, b: { deploy: { text: 'x' } } }, 'deploy')).toEqual({ text: 'x' })
  expect(findPublished({}, 'deploy')).toBe(null)
})

test('the bar draws its saved order, leaves out hidden items, and runs a command item', async ($, on) => {
  const world = stubEngine(on)
  world.store.set(STORE_KEY, [
    DEPLOY,
    { kind: 'builtin', id: 'tools', isHidden: true },
    { kind: 'builtin', id: 'project', isHidden: false },
  ])
  await start($)
  const ui = await $.ui.mount(ROW)

  expect((await ui.find({ key: DEPLOY_KEY }))?.text).toBe('deploy')
  expect(await ui.find({ key: 'tools' })).toBe(undefined)
  expect((await ui.find({ key: 'project' }))?.text).toBe('app')

  await ui.press({ key: DEPLOY_KEY })
  expect(world.ran).toEqual([{ command: 'deploy', args: 'staging' }])
  await ui.unmount()
})

test('a mod that follows the format shows its text and colour in the title\'s place', { plugins: [OTHER_MOD] }, async ($, on) => {
  const world = stubEngine(on)
  world.store.set(STORE_KEY, [DEPLOY])
  await start($)
  const ui = await $.ui.mount(ROW)

  const publish = (value: unknown) => runCommand($, 'publish', JSON.stringify(value))
  await publish({ deploy: { text: '2 running', color: 'warning' } })
  const item = await ui.find({ key: DEPLOY_KEY })
  expect(item?.text).toBe('2 running')
  expect((await ui.find({ type: 'Text', text: /2 running/ }))?.props.color).toBe('warning')

  await publish({})
  expect((await ui.find({ key: DEPLOY_KEY }))?.text).toBe('deploy')
  await ui.unmount()
})

test('separators stand only between things drawn, so none trails the bar', async ($, on) => {
  stubEngine(on)
  await start($)
  // With no repo the branch is left out: project, context, tools, links and notes draw.
  const separators = async (hint: string): Promise<number> => {
    const ui = await $.ui.mount({ ...ROW, props: { ...ROW.props, hint } })
    const found = await ui.findAll({ type: 'Text', text: ' · ' })
    await ui.unmount()
    return found.length
  }

  expect(await separators('? for shortcuts')).toBe(4)
  expect(await separators('')).toBe(4)
})

test('a bar item for /statusbar opens the settings itself, since a mod cannot run its own command', async ($, on) => {
  const world = stubEngine(on)
  world.store.set(STORE_KEY, [{ kind: 'command', title: 'bar', command: 'statusbar', args: '', isHidden: false }])
  await start($)
  const ui = await $.ui.mount(ROW)

  await ui.press({ key: 'item:command:statusbar' })
  expect(world.ran).toEqual([])
  expect(world.opened).toEqual(['project-status-bar'])
  await ui.unmount()
})

test('an item whose mod is not installed leaves the bar and the settings, then returns with it', async ($, on) => {
  const world = stubEngine(on)
  world.commands = ['statusbar', 'ctx']
  world.store.set(STORE_KEY, [DEPLOY])
  await start($)
  const bar = await $.ui.mount(ROW)

  expect((await bar.find({ key: 'context' }))?.text).toBe('ctx 8% (50k/600k)')
  for (const key of ['project', 'tools', 'links', 'notes', DEPLOY_KEY]) {
    expect(await bar.find({ key })).toBe(undefined)
  }
  await bar.unmount()

  await runCommand($, 'statusbar')
  const pane = await $.ui.mount(PANE)
  expect(await pane.find({ key: 'hide:context' })).not.toBe(undefined)
  expect(await pane.find({ key: 'hide:links' })).toBe(undefined)
  expect(await pane.find({ key: 'hide:command:deploy staging' })).toBe(undefined)
  await pane.unmount()

  world.commands = [...ALL_COMMANDS]
  await runCommand($, 'statusbar')
  const again = await $.ui.mount(PANE)
  expect(await again.find({ key: 'hide:links' })).not.toBe(undefined)
  await again.unmount()
})

test('a step past items of mods not installed still moves the item', () => {
  const items = defaultItems()
  const shown = (item: Parameters<typeof itemKey>[0]) => ['project', 'notes'].includes(itemKey(item))
  expect(moveItem(items, 'project', 1, shown).map(itemKey).slice(-2)).toEqual(['notes', 'project'])
  expect(moveItem(items, 'notes', -1, shown).map(itemKey).slice(0, 2)).toEqual(['notes', 'project'])
  expect(moveItem(items, 'notes', 1, shown)).toEqual(items)
})

test('/statusbar says why when its pane will not open', async ($, on) => {
  const world = stubEngine(on)
  world.openError = 'no room'
  await start($)
  const answer = await runCommand($, 'statusbar')
  expect(answer.text).toContain('Could not open the status bar settings')
})

test('a published links count replaces the links label', { plugins: [OTHER_MOD] }, async ($, on) => {
  stubEngine(on)
  await start($)
  const ui = await $.ui.mount(ROW)
  expect((await ui.find({ key: 'links' }))?.text).toBe('links')
  await runCommand($, 'publish', JSON.stringify({ links: { text: '3 links' } }))
  expect((await ui.find({ key: 'links' }))?.text).toBe('3 links')
  await ui.unmount()
})

test('/statusbar adds a known command and saves it for later sessions', async ($, on) => {
  const world = stubEngine(on)
  await start($)
  await runCommand($, 'statusbar')
  const ui = await $.ui.mount(PANE)

  await $.ui.input({ plugin: PLUGIN, key: 'bar-title', text: 'Ship it', kind: 'change' })
  await $.ui.input({ plugin: PLUGIN, key: 'bar-command', text: '/nope', kind: 'change' })
  await ui.press({ key: 'bar-add' })
  expect((await ui.find({ type: 'Text', text: /No command/ }))?.text).toBe('No command /nope in this session')
  expect(world.store.has(STORE_KEY)).toBe(false)

  await $.ui.input({ plugin: PLUGIN, key: 'bar-command', text: '/deploy staging', kind: 'change' })
  await ui.press({ key: 'bar-add' })
  const saved = world.store.get(STORE_KEY) as { title?: string; command?: string; args?: string }[]
  expect(saved.at(-1)).toEqual({ ...DEPLOY, title: 'Ship it' })
  expect(await ui.find({ key: 'remove:command:deploy staging' })).not.toBe(undefined)

  await $.ui.input({ plugin: PLUGIN, key: 'bar-command', text: 'deploy staging', kind: 'change' })
  await ui.press({ key: 'bar-add' })
  expect((await ui.find({ type: 'Text', text: /already/ }))?.text).toBe('/deploy is already on the bar')
  await ui.unmount()
})

test('/statusbar reorders, hides and removes; built-ins cannot be removed', async ($, on) => {
  const world = stubEngine(on)
  world.store.set(STORE_KEY, [DEPLOY])
  await start($)
  await runCommand($, 'statusbar')
  const ui = await $.ui.mount(PANE)
  const keys = () => (world.store.get(STORE_KEY) as Parameters<typeof itemKey>[0][]).map(itemKey)

  await ui.press({ key: 'down:command:deploy staging' })
  expect(keys().slice(0, 2)).toEqual(['project', 'command:deploy staging'])

  await ui.press({ key: 'hide:tools' })
  const hidden = world.store.get(STORE_KEY) as { id?: string; isHidden: boolean }[]
  expect(hidden.find(item => item.id === 'tools')?.isHidden).toBe(true)
  expect((await ui.find({ key: 'hide:tools' }))?.text).toBe('Show')

  expect(await ui.find({ key: 'remove:tools' })).toBe(undefined)
  await ui.press({ key: 'remove:command:deploy staging' })
  expect(keys()).not.toContain('command:deploy staging')
  await ui.unmount()
})

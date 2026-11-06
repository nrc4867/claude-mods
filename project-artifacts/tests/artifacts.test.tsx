import { expect, test } from 'claude-code/testing'
import { openThreadCount, parseArtifactList, refsInCall, settleRefs, statusBarValue } from '../hooks/artifactsRules'

const PLUGIN = 'project-artifacts'
const GIT_DIR = 'C:/ws/app/.git'
const LIB_GIT_DIR = 'C:/ws/lib/.git'
const SLUG_A = '11111111-1111-1111-1111-111111111111'
const SLUG_B = '22222222-2222-2222-2222-222222222222'
const SLUG_C = '33333333-3333-3333-3333-333333333333'
const TYPE_SLUG = '99999999-9999-9999-9999-999999999999'

const PANE = {
  plugin: PLUGIN,
  component: 'Pane',
  requestId: 'project-artifacts',
  surface: 'terminal',
  props: {
    title: 'Artifacts',
    isFocused: true,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

const artifact = (slug: string, title: string, rel = 'mine') => ({
  slug,
  title,
  url: `https://claude.ai/artifact/${title.replace(/\W/g, '')}`,
  rel,
  type_title: 'Design',
  updated_at: '2026-11-01T00:00:00Z',
})

const text = (value: unknown) => [{ type: 'text', text: JSON.stringify(value) }]

const LIST = [artifact(SLUG_A, 'App design'), artifact(SLUG_B, 'Other plan'), artifact(SLUG_C, 'Shared', 'shared')]

type Fake = { store: Map<string, unknown>; calls: string[]; listError: string | null }

/**
 * A session opened in `C:/ws`, a plain folder holding the repos `app` and
 * `lib` and the plain folder `notes`; the artifacts server answers from LIST.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stubEngine = (on: any): Fake => {
  const fake: Fake = { store: new Map(), calls: [], listError: null }
  on('session.cwd', () => ({ value: 'C:/ws' }))
  on('session.root', () => ({ value: 'C:/ws' }))
  on('fs.list', () => ({
    value: ['app', 'lib', 'notes', '.cache'].map(name => ({ name, kind: 'dir', size: 0, mtimeMs: 0, isLink: false })),
  }))
  // The engine may hand paths over with either slash.
  on('fs.exists', (_: unknown, e: any) => ({ value: /[\\/]ws[\\/](app|lib)[\\/]\.git$/.test(e.path) }))
  on('process.run', (_: unknown, e: any) => {
    const repo = /[\\/]ws[\\/](app|lib)([\\/]|$)/.exec(e.init?.cwd ?? '')?.[1]
    return {
      value:
        repo !== undefined && e.argv.includes('--git-common-dir')
          ? { exitCode: 0, stdout: `C:/ws/${repo}/.git\nC:/ws/${repo}\n`, stderr: '' }
          : { exitCode: 128, stdout: '', stderr: '' },
    }
  })
  on('mcp.call', (_: unknown, e: any) => {
    fake.calls.push(`${e.tool}${e.args.slug ? `:${e.args.slug}` : ''}`)
    if (e.tool === 'list_artifacts') {
      return fake.listError === null
        ? { value: { content: text({ artifacts: LIST }), isError: false } }
        : { value: { content: [{ type: 'text', text: fake.listError }], isError: true } }
    }
    const threads = e.args.slug === SLUG_A ? [{ resolved_at: null }, { resolved_at: '2026-11-02T00:00:00Z' }] : []
    return { value: { content: text({ threads }), isError: false } }
  })
  on('store.get', (_: unknown, e: any) => ({ value: fake.store.get(e.key) }))
  on('store.set', (_: unknown, e: any) => {
    fake.store.set(e.key, e.value)
    return { value: undefined }
  })
  on('command.register', () => ({ value: { command: 'repo-artifacts' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_: unknown, e: any) => ({ cwd: e.cwd }))
  return fake
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const openPane = async ($: any) => {
  await $.session.start({ cwd: 'C:/ws', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'repo-artifacts' })
  return $.ui.mount(PANE)
}

test('a list is read newest first, without deleted entries', () => {
  const listed = parseArtifactList([
    { type: 'text', text: 'a notice' },
    ...text({
      artifacts: [
        { ...artifact(SLUG_A, 'Old'), updated_at: '2026-01-01T00:00:00Z' },
        { ...artifact(SLUG_B, 'New'), updated_at: '2026-06-01T00:00:00Z' },
        { ...artifact(SLUG_C, 'Gone'), soft_deleted: true },
      ],
    }),
  ])
  expect(listed?.map(one => one.title)).toEqual(['New', 'Old'])
})

test('only unresolved threads count as open comments', () => {
  expect(openThreadCount(text({ threads: [{ resolved_at: null }, { resolved_at: 'x' }, {}] }))).toBe(2)
  expect(openThreadCount([{ type: 'text', text: 'this artifact is a Claude Doc' }])).toBe(null)
})

test('a created artifact is named by its result, never by the type it came from', () => {
  const result = text({ slug: SLUG_A, type_slug: TYPE_SLUG, url: 'https://claude.ai/artifact/Abc' })
  const refs = refsInCall('mcp__claude-artifacts__create_from_type', { slug: TYPE_SLUG }, result)
  expect(refs).toEqual([SLUG_A, 'https://claude.ai/artifact/Abc'])
  expect(refsInCall('mcp__claude-artifacts__publish_version', { slug: SLUG_B }, {})).toEqual([SLUG_B])
})

test('a URL link becomes the slug once a list names it', () => {
  const listed = parseArtifactList(text({ artifacts: LIST })) ?? []
  const settled = settleRefs({ repo: ['https://claude.ai/artifact/Appdesign', SLUG_A] }, listed)
  expect(settled).toEqual({ repo: [SLUG_A] })
})

test('the status bar counts artifacts and open comments', () => {
  const row = (openComments: number | null) => ({ slug: 's', title: 't', url: 'u', kind: null, updatedAt: 0, openComments })
  expect(statusBarValue([])).toEqual({})
  expect(statusBarValue([row(2), row(null)])).toEqual({ 'repo-artifacts': { text: '2 artifacts · 2 comments' } })
  expect(statusBarValue([row(0)])).toEqual({ 'repo-artifacts': { text: '1 artifact' } })
})

test('from a folder above the repos, each repo shows its own artifacts', async ($, on) => {
  const fake = stubEngine(on)
  fake.store.set('artifact-links', { [GIT_DIR]: [SLUG_A] })
  const ui = await openPane($)

  expect((await ui.find({ type: 'Text', text: /^app$/ }))?.text).toBe('app')
  expect((await ui.find({ type: 'Text', text: /open comment/ }))?.text).toBe('1 open comment')
  expect(await ui.find({ type: 'Text', text: /^lib$/ })).toBe(undefined)
  expect(fake.calls).not.toContain(`read_comments:${SLUG_C}`)
  await ui.unmount()
})

test('a repo folds to its heading, and stays folded', async ($, on) => {
  const fake = stubEngine(on)
  fake.store.set('artifact-links', { [GIT_DIR]: [SLUG_A] })
  const ui = await openPane($)

  await ui.press({ key: `fold:${GIT_DIR}` })
  expect(await ui.find({ key: `unlink:${GIT_DIR}:${SLUG_A}` })).toBe(undefined)
  expect((await ui.find({ type: 'Text', text: /open$/ }))?.text).toBe('1 open')
  expect(fake.store.get('artifact-collapsed')).toEqual([GIT_DIR])

  await ui.press({ key: 'refresh' })
  expect(await ui.find({ key: `unlink:${GIT_DIR}:${SLUG_A}` })).toBe(undefined)
  await ui.press({ key: `fold:${GIT_DIR}` })
  expect((await ui.find({ key: `unlink:${GIT_DIR}:${SLUG_A}` }))?.key).toBe(`unlink:${GIT_DIR}:${SLUG_A}`)
  await ui.unmount()
})

test('To prompt leaves the artifact in the prompt, unsent', async ($, on) => {
  const fake = stubEngine(on)
  const filled: string[] = []
  on('prompt.fill', (_: unknown, e: any) => {
    filled.push(e.text)
    return { isFilled: true }
  })
  fake.store.set('artifact-links', { [GIT_DIR]: [SLUG_A] })
  const ui = await openPane($)

  await ui.press({ key: `prompt:${GIT_DIR}:${SLUG_A}` })
  expect(filled).toEqual(['App design: https://claude.ai/artifact/Appdesign\n'])
  await ui.unmount()
})

test('an artifact in no repo is linked to the repo picked for it', async ($, on) => {
  const fake = stubEngine(on)
  const ui = await openPane($)

  await ui.press({ key: 'toggle-unlinked' })
  await ui.press({ key: `pick:${SLUG_B}` })
  expect(await ui.find({ key: `link:${SLUG_B}:C:/ws/notes/.git` })).toBe(undefined)
  await ui.press({ key: `link:${SLUG_B}:${LIB_GIT_DIR}` })

  expect(fake.store.get('artifact-links')).toEqual({ [LIB_GIT_DIR]: [SLUG_B] })
  expect((await ui.find({ type: 'Text', text: /^lib$/ }))?.text).toBe('lib')
  await ui.unmount()
})

const publishResult = () => ({ result: [{ type: 'text', text: JSON.stringify({ slug: SLUG_B, version: 'v1' }) }] })

test('a publish joins the repo the session last touched a file in', async ($, on) => {
  const fake = stubEngine(on)
  on('tool.call', publishResult)
  await $.session.start({ cwd: 'C:/ws', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'Edit', file_path: 'C:\\ws\\lib\\src\\index.ts', old_string: 'a', new_string: 'b' })
  await $.tool.call({ tool: 'mcp__claude-artifacts__publish_version', title: 'x', content: '<!DOCTYPE html>' })

  expect(fake.store.get('artifact-links')).toEqual({ [LIB_GIT_DIR]: [SLUG_B] })
})

test('a publish before any repo was touched stays in no repo', async ($, on) => {
  const fake = stubEngine(on)
  on('tool.call', publishResult)
  await $.session.start({ cwd: 'C:/ws', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'Read', file_path: 'C:/ws/notes/todo.md' })
  await $.tool.call({ tool: 'mcp__claude-artifacts__publish_version', title: 'x', content: '<!DOCTYPE html>' })

  expect(Object.values((fake.store.get('artifact-links') ?? {}) as object).flat()).toEqual([])
})

test('a refused list shows the server’s words', async ($, on) => {
  const fake = stubEngine(on)
  fake.listError = 'auth needed'
  const ui = await openPane($)
  expect((await ui.find({ type: 'Text', text: /auth needed/ }))?.text).toBe('auth needed')
  await ui.unmount()
})

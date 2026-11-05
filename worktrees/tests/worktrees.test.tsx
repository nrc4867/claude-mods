import { expect, test } from 'claude-code/testing'
import { newestActivity, parseCommitTime } from '../hooks/activity'
import { parseDiff } from '../hooks/fileDiff'
import { elapsed } from '../hooks/formatUtils'
import {
  parseBranches,
  parseNameStatus,
  parseStatus,
  parseWorktreeList,
  unquotePath,
} from '../hooks/worktrees'

const PANE = {
  plugin: 'worktrees',
  component: 'Pane',
  requestId: 'worktrees',
  surface: 'terminal',
  props: {
    title: 'Worktrees',
    isFocused: false,
    bodyColumns: 80,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

const WORKTREE_LIST =
  'worktree C:/ws/app\nHEAD aaa\nbranch refs/heads/main\n\n' +
  'worktree C:/ws/app-ff\nHEAD bbb\nbranch refs/heads/feature/ff\n\n' +
  'worktree C:/ws/app-done\nHEAD ccc\nbranch refs/heads/feature/done\n\n' +
  'worktree C:/ws/app-clash\nHEAD ddd\nbranch refs/heads/feature/clash\n\n'

const STATUS: Record<string, string> = {
  'C:/ws/app': '## main...origin/main\n M src/a.ts\n',
  'C:/ws/app-ff': '## feature/ff\n',
  'C:/ws/app-done': '## feature/done\n',
  'C:/ws/app-clash': '## feature/clash\n?? scratch.txt\n',
}

const DIFF_HEADER = 'diff --git a/f b/f\nindex 1..2 100644\n--- a/f\n+++ b/f\n'
const MODIFIED_HUNK = '@@ -1 +1 @@\n-old line\n+new line\n'
const NEW_FILE_HUNK = '@@ -0,0 +1 @@\n+scratch line\n'
const CRLF_HUNK = '@@ -1 +1 @@\r\n-old\r\n+new\r\n'

const BACKSLASH = String.fromCharCode(92)
const norm = (path: string | undefined): string => (path ?? '').split(BACKSLASH).join('/')

type Answer = { exitCode: number; stdout: string }
const yes = (stdout = ''): Answer => ({ exitCode: 0, stdout })
const no = (exitCode = 1): Answer => ({ exitCode, stdout: '' })

/** Answers `$.process.run` as git would for the repo above. */
const fakeGit = (argv: readonly string[], cwd: string): Answer => {
  const line = argv
    .slice(1)
    .join(' ')
    .replace('-c core.quotePath=false ', '')
    .replace('--literal-pathspecs ', '')
  if (line.includes('--no-index')) return { exitCode: 1, stdout: `${DIFF_HEADER}${NEW_FILE_HUNK}` }
  if (line.startsWith('diff') && !line.includes('--name-status')) {
    return yes(line.includes('win.ts') ? `${DIFF_HEADER}${CRLF_HUNK}` : `${DIFF_HEADER}${MODIFIED_HUNK}`)
  }
  if (line.startsWith('worktree list')) return yes(WORKTREE_LIST)
  if (line.startsWith('log -1')) return yes(`${Math.floor((Date.now() - 5 * 86_400_000) / 1000)}\n`)
  if (line.includes('--show-toplevel')) return yes('C:/ws/app\n')
  if (line.includes('--abbrev-ref')) return yes('main\n')
  if (line.startsWith('symbolic-ref')) return no()
  if (line.startsWith('show-ref')) return line.endsWith('refs/heads/main') ? yes() : no()
  if (line.startsWith('status')) return yes(STATUS[cwd] ?? '')
  if (line.startsWith('merge-base')) {
    return line === 'merge-base --is-ancestor main feature/ff' ||
      line === 'merge-base --is-ancestor feature/done main'
      ? yes()
      : no()
  }
  if (line.startsWith('cherry')) return yes('+ abc\n')
  if (line.startsWith('merge-tree')) {
    return line.includes('clash')
      ? { exitCode: 1, stdout: 'tree2\nsrc/a.ts\nsrc/b.ts\n\nAuto-merging src/a.ts\n' }
      : yes('tree1\n')
  }
  if (line.startsWith('rev-parse')) return yes('tree0\n')
  if (line.startsWith('diff')) return yes(cwd.endsWith('ff') ? 'M\tsrc/ff.ts\n' : '')
  if (line.startsWith('for-each-ref')) return yes('main\t\nold\t[behind 3]\n')
  return yes()
}

const stubEngine = (on: any, paneError: string | null = null): string[] => {
  const ran: string[] = []
  on('session.root', () => ({ value: 'C:/ws/app' }))
  on('session.cwd', () => ({ value: 'C:/ws/app' }))
  on('session.usage', () => ({
    value: { context: { tokens: 50_000, window: 600_000, percent: 8 } },
  }))
  on('process.run', (_: unknown, e: any) => {
    const cwd = norm(e.init?.cwd)
    ran.push(`${cwd}> ${e.argv.slice(1).join(' ')}`)
    return { value: { ...fakeGit(e.argv, cwd), stderr: '' } }
  })
  on('ui.panes', () => {
    if (paneError !== null) throw new Error(paneError)
    return { value: [] }
  })
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('command.register', () => ({ value: { command: 'worktrees' } }))
  on('session.start', (_: unknown, e: any) => ({ cwd: e.cwd }))
  return ran
}

const openPane = async ($: any) => {
  await $.session.start({ cwd: 'C:/ws/app', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'worktrees' })
  return $.ui.mount(PANE)
}

test('parsers read git porcelain', () => {
  expect(parseWorktreeList('worktree C:/ws/app\nHEAD aaa\nbranch refs/heads/feature/x\n\n')).toEqual([
    { path: 'C:/ws/app', head: 'aaa', branch: 'feature/x' },
  ])
  expect(parseWorktreeList('worktree C:/ws/old\nHEAD ccc\ndetached\n\n')).toEqual([
    { path: 'C:/ws/old', head: 'ccc', branch: null },
  ])
  expect(parseWorktreeList('worktree C:/ws/bare.git\nbare\n\n')).toEqual([])
  expect(parseStatus('## main...origin/main [ahead 2, behind 1]\n M a.ts\n?? b.ts\n')).toEqual({
    ahead: 2,
    behind: 1,
    files: [
      { code: ' M', path: 'a.ts' },
      { code: '??', path: 'b.ts' },
    ],
  })
  expect(parseNameStatus('M\ta.ts\nD\tb.ts\n')).toEqual([
    { code: 'M ', path: 'a.ts' },
    { code: 'D ', path: 'b.ts' },
  ])
  expect(parseBranches('main\t[ahead 2]\nold\t[behind 3]\nnew\t\n')).toEqual([
    { name: 'main', ahead: 2, behind: 0 },
    { name: 'old', ahead: 0, behind: 3 },
    { name: 'new', ahead: 0, behind: 0 },
  ])
})

test('/worktrees shows landed state, files against the base and uncommitted files', async ($, on) => {
  stubEngine(on)
  const pane = await openPane($)

  expect((await pane.find({ type: 'Text', text: /^ ✓ landed$/ }))?.text).toBe(' ✓ landed')
  expect((await pane.find({ type: 'Text', text: /^ ✗ conflicts$/ }))?.text).toBe(' ✗ conflicts')
  expect((await pane.find({ type: 'Text', text: /^src\/a\.ts$/ }))?.text).toBe('src/a.ts')
  expect(await pane.find({ key: 'merge' })).toBeUndefined()

  await pane.press({ key: 'worktree:C:/ws/app-ff' })
  expect((await pane.find({ type: 'Text', text: /^src\/ff\.ts$/ }))?.text).toBe('src/ff.ts')
  expect((await pane.find({ type: 'Text', text: /^Not landed$/ }))?.text).toBe('Not landed')
  await pane.unmount()
})

test('merging fast-forwards the base in the worktree that holds it', async ($, on) => {
  const ran = stubEngine(on)
  const pane = await openPane($)

  await pane.press({ key: 'worktree:C:/ws/app-ff' })
  expect((await pane.find({ key: 'merge' }))?.text).toBe('Merge to main (ff)')
  await pane.press({ key: 'merge' })

  expect(ran).toContain('C:/ws/app> merge --ff-only feature/ff')
  await pane.unmount()
})

test('safe cleanup waits for a confirming press and uses no force on the worktree', async ($, on) => {
  const ran = stubEngine(on)
  const pane = await openPane($)

  await pane.press({ key: 'worktree:C:/ws/app-done' })
  await pane.press({ key: 'cleanup' })
  expect(ran.some(r => r.includes('worktree remove'))).toBe(false)
  expect((await pane.find({ key: 'cleanup' }))?.text).toBe('Confirm remove worktree and branch')

  await pane.press({ key: 'cleanup' })
  expect(ran).toContain('C:/ws/app> worktree remove C:/ws/app-done')
  expect(ran).toContain('C:/ws/app> branch -D feature/done')
  await pane.unmount()
})

test('a conflict goes into the prompt box unsent, after any draft', async ($, on) => {
  const ran = stubEngine(on)
  const fills: { text: string; mode?: string }[] = []
  on('prompt.fill', (_: unknown, e: any) => {
    fills.push({ text: e.text, mode: e.mode })
    return { isFilled: true }
  })
  const pane = await openPane($)

  await pane.press({ key: 'worktree:C:/ws/app-clash' })
  await pane.press({ key: 'conflict-prompt' })

  expect(fills.length).toBe(1)
  expect(fills[0]?.mode).toBe('append')
  expect(fills[0]?.text).toContain('`feature/clash` and `main`')
  expect(fills[0]?.text).toContain('Worktree: C:/ws/app-clash')
  expect(fills[0]?.text).toContain('- src/a.ts\n- src/b.ts\n')
  expect(ran.some(r => r.includes('> rebase'))).toBe(false)
  await pane.unmount()
})

test('last activity is the newer of the commit and the edits, shown as an age', () => {
  expect(parseCommitTime('1700000000\n')).toBe(1_700_000_000_000)
  expect(parseCommitTime('')).toBe(null)
  expect(parseCommitTime(null)).toBe(null)
  expect(newestActivity(100, 200)).toEqual({ at: 200, kind: 'edit' })
  expect(newestActivity(200, 100)).toEqual({ at: 200, kind: 'commit' })
  expect(newestActivity(200, null)).toEqual({ at: 200, kind: 'commit' })
  expect(newestActivity(null, null)).toBe(null)
  expect(elapsed(0, 30_000)).toBe('now')
  expect(elapsed(0, 5 * 60_000)).toBe('5m')
  expect(elapsed(0, 3 * 3_600_000)).toBe('3h')
  expect(elapsed(0, 12 * 86_400_000)).toBe('12d')
})

test('the pane shows each worktree\'s last activity, a fresher edit beating the commit', async ($, on) => {
  stubEngine(on)
  const now = Date.now()
  on('fs.stat', () => ({ value: { kind: 'file', size: 1, mtimeMs: now - 2 * 3_600_000, isLink: false } }))

  const ui = await openPane($)
  // `app` has an uncommitted file, so its edit is newest; `app-ff` has only its commit.
  expect((await ui.find({ key: 'worktree:C:/ws/app' }))?.text).toContain('· 2h')
  expect((await ui.find({ key: 'worktree:C:/ws/app-ff' }))?.text).toContain('· 5d')
  expect((await ui.find({ type: 'Text', text: /Last edit/ }))?.text).toBe('Last edit 2h ago')
  await ui.unmount()
})

test('a diff is read into whole, drawable hunks', () => {
  expect(parseDiff(`${DIFF_HEADER}${CRLF_HUNK}`)).toEqual({
    kind: 'hunks',
    source: '@@ -1 +1 @@\n-old\n+new\n',
    shown: 1,
    total: 1,
  })
  expect(parseDiff('diff --git a/b b/b\nBinary files a/b and b/b differ\n').kind).toBe('binary')
  expect(parseDiff('').kind).toBe('empty')

  const two = `${DIFF_HEADER}@@ -1 +1 @@\n-a\n+b\n@@ -9 +9 @@\n-c\n+d\n`
  expect(parseDiff(two, 20)).toEqual({ kind: 'hunks', source: '@@ -1 +1 @@\n-a\n+b', shown: 1, total: 2 })
  expect(parseDiff(two, 5).kind).toBe('too-large')
  expect(unquotePath('"my file.ts"')).toBe('my file.ts')
  expect(unquotePath('plain.ts')).toBe('plain.ts')
})

test('clicking a file shows its diff, and Back returns to the lists', async ($, on) => {
  const ran = stubEngine(on)
  on('ui.scroll', () => ({}))
  const pane = await openPane($)

  await pane.press({ key: 'uncommitted:src/a.ts' })
  expect(ran.some(r => r.includes('--no-renames HEAD -- src/a.ts'))).toBe(true)
  expect((await pane.find({ type: 'Code' }))?.text).toContain('+new line')
  expect(await pane.find({ key: 'cleanup' })).toBeUndefined()

  await pane.press({ key: 'diff-back' })
  expect(await pane.find({ type: 'Code' })).toBeUndefined()
  expect((await pane.find({ key: 'repos' }))?.text).toBe('Repos')

  await pane.press({ key: 'worktree:C:/ws/app-clash' })
  await pane.press({ key: 'uncommitted:scratch.txt' })
  expect((await pane.find({ type: 'Code' }))?.text).toContain('+scratch line')
  await pane.unmount()

})

test('a worktree with changes or unlanded work offers no cleanup or merge', async ($, on) => {
  stubEngine(on)
  const pane = await openPane($)

  await pane.press({ key: 'worktree:C:/ws/app-clash' })
  expect(await pane.find({ key: 'cleanup' })).toBeUndefined()
  expect(await pane.find({ key: 'merge' })).toBeUndefined()
  expect((await pane.find({ type: 'Text', text: /^Cleanup:/ }))?.text).toContain('uncommitted changes')
  await pane.unmount()
})

test('pressing the status bar\'s branch item opens the pane', {
  plugins: [{
    name: 'project-status',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    register: (on: any) => {
      on('ui.render', { component: 'PromptHint' }, ($: any, e: any) => {
        const { Button } = $.ui.resolve(e)
        return <Button key="branch" label="main" onPress={() => undefined} />
      })
    },
  }],
}, async ($, on) => {
  const ran = stubEngine(on)
  await $.session.start({ cwd: 'C:/ws/app', surface: 'terminal', isInteractive: true })
  const bar = await $.ui.mount({
    plugin: 'project-status',
    component: 'PromptHint',
    requestId: 'hint',
    surface: 'terminal',
    props: { isDraft: false, isWorking: false, hint: '' },
  })
  expect(ran.some(line => line.includes('worktree list'))).toBe(false)
  await bar.press({ key: 'branch' })
  expect(ran.some(line => line.includes('worktree list'))).toBe(true)
  await bar.unmount()
})

test('/worktrees says why when its pane will not open', async ($, on) => {
  stubEngine(on, 'no room')
  await $.session.start({ cwd: 'C:/ws/app', surface: 'terminal', isInteractive: true })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const answer = await ($ as any).command.run({ command: 'worktrees' })
  expect(answer.text).toContain('Could not open the Worktrees pane')
})

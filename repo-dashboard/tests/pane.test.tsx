import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'repo-dashboard',
  component: 'Pane',
  requestId: 'repo-dashboard',
  props: {
    title: 'Repos',
    isFocused: false,
    bodyColumns: 50,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

/** The engine resolves paths for the host (`C:\ws\alpha` on Windows). */
const norm = (path: string): string => path.replace(/\\/g, '/').replace(/^[A-Za-z]:/, '')

const REPOS = new Set(['/ws/alpha', '/ws/beta'])

const STATUS: Record<string, string> = {
  '/ws/alpha': '## main...origin/main [ahead 2, behind 1]\n M a.ts\n?? b.ts\n',
  '/ws/beta': '## feature/x.y...origin/feature/x.y\n',
}

test('scanning lists each repo with branch, changes and ahead/behind', async ($, on) => {
  on('session.root', () => ({ value: '/ws' }))
  on('fs.exists', (_, e) => ({ value: REPOS.has(norm(e.path).replace(/\/\.git$/, '')) }))
  on('fs.list', () => ({
    value: ['alpha', 'beta', 'notes'].map(name => ({
      name, kind: 'dir' as const, size: 0, mtimeMs: 0, isLink: false,
    })),
  }))
  on('process.run', (_, e) => ({
    value: { exitCode: 0, stdout: STATUS[norm(e.argv[2] ?? '')] ?? '', stderr: '' },
  }))

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    await ui.press({ key: 'refresh' })

    expect((await ui.find({ type: 'Text', text: /2 repos/ }))?.text).toContain('1 dirty')
    expect((await ui.find({ type: 'Text', text: /^main$/ }))?.text).toBe('main')
    expect((await ui.find({ type: 'Text', text: /feature/ }))?.text).toBe('feature/x.y')
    expect((await ui.find({ type: 'Text', text: /●/ }))?.text?.trim()).toBe('●2')
    expect((await ui.find({ type: 'Text', text: /↑/ }))?.text?.trim()).toBe('↑2')
    expect((await ui.find({ type: 'Text', text: /↓/ }))?.text?.trim()).toBe('↓1')
    expect(await ui.find({ type: 'Text', text: /notes/ })).toBeUndefined()
    await ui.unmount()
  }
})

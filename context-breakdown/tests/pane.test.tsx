import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'context-breakdown',
  component: 'Pane',
  requestId: 'context-breakdown',
  props: {
    title: 'Context',
    isFocused: false,
    bodyColumns: 50,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

const category = (name: string, tokens: number, kind: 'used' | 'free' | 'buffer' | 'deferred') => ({
  name, tokens, kind, color: 'promptBorder', isDeferred: kind === 'deferred',
})

test('refreshing draws categories, memory files and MCP servers', async ($, on) => {
  on('session.usage', () => ({
    value: {
      startedAt: Date.now() - 72 * 60_000,
      cost: { usd: 3.4 },
      rateLimits: [
        { kind: 'five_hour', percentUsed: 42.5, resetsAt: new Date(Date.now() + 2 * 3_600_000).toISOString() },
        { kind: 'seven_day', percentUsed: 91, resetsAt: new Date(Date.now() + 3 * 86_400_000).toISOString() },
      ],
      context: {
        tokens: 50_000,
        window: 600_000,
        percent: 8,
        breakdown: {
          categories: [
            category('System tools', 20_000, 'used'),
            category('Messages', 30_000, 'used'),
            category('Free space', 550_000, 'free'),
            category('MCP tools (deferred)', 9_000, 'deferred'),
          ],
          totalTokens: 50_000,
          maxTokens: 600_000,
          rawMaxTokens: 600_000,
          autocompactSource: 'settings',
          percentage: 8,
          gridRows: [],
          model: 'opus',
          memoryFiles: [{ path: 'C:/Users/n/IdeaProjects/CLAUDE.md', type: 'Project', tokens: 2_100 }],
          mcpTools: [
            { name: 'a', serverName: 'intellij', tokens: 1_000, isLoaded: true },
            { name: 'b', serverName: 'intellij', tokens: 500, isLoaded: true },
            { name: 'c', serverName: 'gmail', tokens: 900, isLoaded: false },
          ],
          agents: [],
          isAutoCompactEnabled: true,
          autoCompactThreshold: 540_000,
          apiUsage: null,
        },
      },
    },
  }))

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    await ui.press({ key: 'refresh' })

    expect((await ui.find({ type: 'Text', text: /session/ }))?.text).toContain('Usage session 1h 12m · $3.40')
    expect((await ui.find({ type: 'Text', text: /^5-hour/ }))?.text).toMatch(/^5-hour ↻\d\d:\d\d$/)
    expect((await ui.find({ type: 'Text', text: /^Weekly/ }))?.text).toMatch(/^Weekly ↻[A-Z][a-z]{2} \d\d:\d\d$/)
    expect((await ui.find({ type: 'Text', text: /^43%$/ }))?.text).toBe('43%')
    expect((await ui.find({ type: 'Text', text: /^91%$/ }))?.text).toBe('91%')
    expect((await ui.find({ type: 'Text', text: /^Messages$/ }))?.text).toBe('Messages')
    expect((await ui.find({ type: 'Text', text: /^Free$/ }))?.text).toBe('Free')
    expect((await ui.find({ type: 'Text', text: /IdeaProjects\/CLAUDE\.md/ }))?.text).toBe('IdeaProjects/CLAUDE.md')
    expect((await ui.find({ type: 'Text', text: /^intellij$/ }))?.text).toBe('intellij')
    expect(await ui.find({ type: 'Text', text: /gmail/ })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /deferred/ })).toBeUndefined()
    await ui.unmount()
  }
})

test('the session row shows the id and transcript link, and copies the resume command', async ($, on) => {
  const copied: string[] = []
  on('session.id', () => ({ value: 'abcdef12-3456' }))
  on('session.root', () => ({ value: 'C:\\ws\\my app' }))
  on('env.get', (_, e) => ({ value: e.name === 'USERPROFILE' ? 'C:\\Users\\me' : undefined }))
  on('fs.stat', (_, e) => {
    const isTranscript = e.path.replace(/\\/g, '/') === 'C:/Users/me/.claude/projects/C--ws-my-app/abcdef12-3456.jsonl'
    return { value: { kind: isTranscript ? 'file' : 'other', size: 1, mtimeMs: 0, isLink: false } }
  })
  on('ui.copy', (_, e) => {
    copied.push(e.text)
    return { value: { isCopied: true } }
  })
  on('ui.toast', () => ({ value: undefined }))

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /abcdef12/ }))?.text).toContain('abcdef12')
  const link = await ui.find({ type: 'Link' })
  expect(link?.props.href).toBe('file:///C:/Users/me/.claude/projects/C--ws-my-app/abcdef12-3456.jsonl')
  await ui.press({ key: 'copy-resume' })
  expect(copied).toEqual(['claude --resume abcdef12-3456'])
  await ui.unmount()
})

test('a background session links its job folder; any other session has no job link', async ($, on) => {
  let jobDir: string | undefined
  on('session.id', () => ({ value: 'abcdef12-3456' }))
  on('session.root', () => ({ value: 'C:\\ws\\app' }))
  on('env.get', (_, e) => ({ value: e.name === 'CLAUDE_JOB_DIR' ? jobDir : undefined }))
  on('fs.stat', (_, e) => {
    const isJob = e.path.replace(/\\/g, '/') === 'C:/Users/me/.claude/jobs/f63bb273'
    return { value: { kind: isJob ? 'dir' : 'other', size: 0, mtimeMs: 0, isLink: false } }
  })

  const without = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await without.find({ type: 'Link' })).toBe(undefined)
  await without.unmount()

  jobDir = 'C:\\Users\\me\\.claude\\jobs\\f63bb273'
  const within = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const link = await within.find({ type: 'Link' })
  expect(link?.props.href).toBe('file:///C:/Users/me/.claude/jobs/f63bb273')
  expect(link?.props.label).toBe('job f63bb273')
  await within.unmount()
})

test('the transcript links from a Mac\'s home folder', async ($, on) => {
  on('session.id', () => ({ value: 'abcdef12-3456' }))
  on('session.root', () => ({ value: '/Users/me/my app' }))
  on('env.get', (_, e) => ({ value: e.name === 'HOME' ? '/Users/me' : undefined }))
  on('fs.stat', (_, e) => {
    const isTranscript = e.path.replace(/^[A-Za-z]:/, '').replace(/\\/g, '/') === '/Users/me/.claude/projects/-Users-me-my-app/abcdef12-3456.jsonl'
    return { value: { kind: isTranscript ? 'file' : 'other', size: 1, mtimeMs: 0, isLink: false } }
  })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const link = await ui.find({ type: 'Link' })
  expect(link?.props.href).toBe('file:///Users/me/.claude/projects/-Users-me-my-app/abcdef12-3456.jsonl')
  await ui.unmount()
})

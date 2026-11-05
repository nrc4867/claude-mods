import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'
import type { RepoStatus } from '../types'
import {
  CHROME_ROWS,
  GIT_COMMAND_PATTERN,
  MARKER_COLUMNS,
  NAME_COLUMNS,
  PANE_TITLE,
  REPO_ROW_PREFIX,
} from './constants'
import { basename } from './pathUtils'
import { scanRepos } from './scan'

// Literal here so the engine can match the command and pane by name.
const COMMAND = 'repos'
const PANE_ID = 'repo-dashboard'

const scan = atom({ plugin: 'repo-dashboard', key: 'scan' } as const, null, { shape: 'scan-1' })

async function refresh($: EngineInterface): Promise<void> {
  const next = await scanRepos($)
  await update($, scan, () => next)
}

const clock = (ms: number): string => {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const isClean = (r: RepoStatus): boolean => r.changes === 0 && r.ahead === 0 && r.behind === 0

const nameCell = (name: string, isCurrent: boolean): string => {
  const room = NAME_COLUMNS - MARKER_COLUMNS
  const fitted = name.length > room ? `${name.slice(0, room - 1)}…` : name.padEnd(room)
  return `${isCurrent ? '▸ ' : '  '}${fitted}`
}

/** The project-status mod answers a press on a repo row with its Worktrees pane. */
const answeredElsewhere = (): void => undefined

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: COMMAND, description: 'Show git status of sibling repos' })
    return next(e)
  })

  on('command.run', { command: COMMAND }, async $ => {
    await $.ui.open({ id: PANE_ID, title: PANE_TITLE })
    await refresh($).catch(() => undefined)
    return { text: 'Repo dashboard opened.' }
  })

  on('ui.press', { plugin: 'project-status', element: 'project' }, async ($, e, next) => {
    const panes = await $.ui.panes()
    if (panes.some(p => p.id === PANE_ID && !p.isShown)) await $.ui.close({ id: PANE_ID })
    await $.ui.open({ id: PANE_ID, title: PANE_TITLE })
    await refresh($).catch(() => undefined)
    return next(e)
  })

  on('ui.press', { plugin: 'project-status', element: 'repos' }, async ($, e, next) => {
    const panes = await $.ui.panes()
    if (panes.some(p => p.id === PANE_ID && !p.isShown)) await $.ui.close({ id: PANE_ID })
    await $.ui.open({ id: PANE_ID, title: PANE_TITLE })
    await refresh($).catch(() => undefined)
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    await refresh($).catch(() => undefined)
    return done
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const ran = await next(e)
    if (GIT_COMMAND_PATTERN.test(e.command)) await refresh($).catch(() => undefined)
    return ran
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE_ID }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const state = await read($, scan)
    const room = Math.max(1, e.props.scroll.bodyRows - CHROME_ROWS)
    const onRefresh = () => void refresh($).catch(() => undefined)

    if (state === null) {
      return (
        <Box flexDirection="column">
          <Text dimColor>Not scanned yet.</Text>
          <Button key="refresh" hotkey="r" label="Scan" onPress={onRefresh} />
        </Box>
      )
    }

    const dirty = state.repos.filter(r => !isClean(r)).length

    return (
      <Box flexDirection="column">
        <Box flexDirection="row" justifyContent="space-between">
          <Text dimColor wrap="truncate-end">
            {basename(state.dir)} · {state.repos.length} repos · {dirty} dirty · {clock(state.at)}
          </Text>
          <Button key="refresh" hotkey="r" label="Refresh" onPress={onRefresh} />
        </Box>
        {state.repos.length === 0 && <Text dimColor>No git repos here.</Text>}
        {state.repos.slice(0, room).map(r => (
          <Button key={`${REPO_ROW_PREFIX}${r.path}`} plain onPress={answeredElsewhere}>
            <Text bold={r.path === state.current}>
              {nameCell(r.name, r.path === state.current)}
            </Text>
            <Text dimColor>{r.branch ?? 'unreadable'}</Text>
            {isClean(r) && <Text color="success"> ✓</Text>}
            {r.changes > 0 && <Text color="warning"> ●{r.changes}</Text>}
            {r.ahead > 0 && <Text color="suggestion"> ↑{r.ahead}</Text>}
            {r.behind > 0 && <Text color="error"> ↓{r.behind}</Text>}
          </Button>
        ))}
        {state.repos.length > room && <Text dimColor>+{state.repos.length - room} more</Text>}
      </Box>
    )
  })
}

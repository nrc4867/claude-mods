import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'
import type { ContextRow } from '../types'
import {
  LABEL_COLUMNS,
  MIN_BAR_COLUMNS,
  PANE_TITLE,
  TOKEN_COLUMNS,
  USAGE_ERROR_PERCENT,
  USAGE_WARN_PERCENT,
} from './constants'
import { bar, clock, compactTokens, duration, resetTime, usd } from './formatUtils'
import { SessionRow } from './sessionRow'
import { takeSnapshot } from './snapshot'

const usageColor = (percent: number): string =>
  percent >= USAGE_ERROR_PERCENT ? 'error' : percent >= USAGE_WARN_PERCENT ? 'warning' : 'success'

// Literal here so the engine can match the command and pane by name.
const COMMAND = 'ctx'
const PANE_ID = 'context-breakdown'

const snapshot = atom({ plugin: 'context-breakdown', key: 'snapshot' } as const, null, {
  shape: 'snapshot-2',
})

async function refresh($: EngineInterface): Promise<void> {
  const next = await takeSnapshot($)
  if (next !== null) await update($, snapshot, () => next)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: COMMAND, description: 'Show context window and plan usage' })
    return next(e)
  })

  on('command.run', { command: COMMAND }, async $ => {
    await $.ui.open({ id: PANE_ID, title: PANE_TITLE })
    await refresh($).catch(() => undefined)
    return { text: 'Context pane opened.' }
  })

  on('ui.press', { plugin: 'project-status', element: 'context' }, async ($, e, next) => {
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

  on('session.measure', async ($, e, next) => {
    const measured = await next(e)
    if (e.changed.includes('rateLimits')) await refresh($).catch(() => undefined)
    return measured
  })

  on('ui.render', { component: 'Pane', requestId: PANE_ID }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const snap = await read($, snapshot)
    const session = await SessionRow($, e)
    const onRefresh = () => void refresh($).catch(() => undefined)
    const barWidth = Math.max(MIN_BAR_COLUMNS, e.props.bodyColumns - LABEL_COLUMNS - TOKEN_COLUMNS - 1)

    const row = (r: ContextRow, whole: number, key: string) => (
      <Box flexDirection="row" key={key}>
        <Box width={LABEL_COLUMNS}>
          <Text wrap="truncate-end">{r.name}</Text>
        </Box>
        <Text color={r.color}>{bar(r.tokens, whole, barWidth)}</Text>
        <Box width={TOKEN_COLUMNS + 1} justifyContent="flex-end">
          <Text tabular dimColor>{compactTokens(r.tokens)}</Text>
        </Box>
      </Box>
    )

    if (snap === null) {
      return (
        <Box flexDirection="column">
          {session}
          <Text dimColor>No reading yet: it fills in after the next response.</Text>
          <Button key="refresh" hotkey="r" label="Refresh" onPress={onRefresh} />
        </Box>
      )
    }

    const memoryTotal = snap.memoryFiles.reduce((n, r) => n + r.tokens, 0)
    const mcpTotal = snap.mcpServers.reduce((n, r) => n + r.tokens, 0)

    return (
      <Box flexDirection="column">
        {session}
        <Box flexDirection="row" justifyContent="space-between">
          <Text>
            <Text bold>{snap.percent}%</Text>
            <Text dimColor>
              {' '}· {compactTokens(snap.totalTokens)} / {compactTokens(snap.maxTokens)}
              {snap.autoCompactAt !== null ? ` · compacts at ${compactTokens(snap.autoCompactAt)}` : ''}
              {' '}· {clock(snap.at)}
            </Text>
          </Text>
          <Button key="refresh" hotkey="r" label="Refresh" onPress={onRefresh} />
        </Box>

        <Text bold>
          {'\n'}Usage{' '}
          <Text dimColor>
            session {duration(snap.at - snap.startedAt)}
            {snap.costUsd !== null ? ` · ${usd(snap.costUsd)}` : ''}
          </Text>
        </Text>
        {snap.rateLimits.length === 0 && <Text dimColor>No plan limits reported yet.</Text>}
        {snap.rateLimits.map(l => (
          <Box flexDirection="row" key={`limit:${l.label}`}>
            <Box width={LABEL_COLUMNS}>
              <Text wrap="truncate-end">
                {l.label}
                {l.resetsAt !== null && <Text dimColor> ↻{resetTime(l.resetsAt, snap.at)}</Text>}
              </Text>
            </Box>
            <Text color={usageColor(l.percentUsed)}>{bar(l.percentUsed, 100, barWidth)}</Text>
            <Box width={TOKEN_COLUMNS + 1} justifyContent="flex-end">
              <Text tabular dimColor>{Math.round(l.percentUsed)}%</Text>
            </Box>
          </Box>
        ))}

        <Text bold>{'\n'}Window</Text>
        {snap.categories.map(c => row(c, snap.maxTokens, `cat:${c.name}`))}
        {row({ name: 'Free', tokens: snap.freeTokens, color: 'inactive' }, snap.maxTokens, 'cat:free')}

        {snap.memoryFiles.length > 0 && (
          <Text bold>{'\n'}Memory files <Text dimColor>{compactTokens(memoryTotal)}</Text></Text>
        )}
        {snap.memoryFiles.map(f => row(f, memoryTotal, `mem:${f.name}`))}

        {snap.mcpServers.length > 0 && (
          <Text bold>{'\n'}MCP servers <Text dimColor>{compactTokens(mcpTotal)}</Text></Text>
        )}
        {snap.mcpServers.map(s => row(s, mcpTotal, `mcp:${s.name}`))}

        {snap.skillsTokens > 0 && (
          <Text dimColor>{'\n'}Skills listing: {compactTokens(snap.skillsTokens)}</Text>
        )}
      </Box>
    )
  })
}

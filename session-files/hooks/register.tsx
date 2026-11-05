import type { EngineInterface, Register, ToolCallResult } from 'claude-code'
import type { ToolRunStatus } from '../types'
import { PANE_TITLE } from './constants'
import { declareLinks, registerLinks } from './links'
import { renderPane } from './pane'
import { storeEdit, storeRead, storeRunEnd, storeRunStart } from './store'
import type { ToolInput } from './toolSummary'
import { displayToolName, readPath, summarizeCall, writtenPath } from './toolSummary'
import { locateFile, measureFile } from './tracker'

// Literal here so the engine can match the command and pane by name.
const COMMAND = 'files'
const PANE_ID = 'session-files'

let nextCallId = 0

const statusOf = (ran: ToolCallResult): ToolRunStatus =>
  ran.deny !== undefined ? 'denied' : ran.isError === true ? 'error' : 'ok'

/** Files the settled call wrote or read, filed in their sections. */
async function recordFiles($: EngineInterface, tool: string, input: ToolInput): Promise<void> {
  const written = writtenPath(tool, input)
  if (written !== undefined) await storeEdit($, await measureFile($, written))
  const readFrom = readPath(tool, input)
  if (readFrom !== undefined) await storeRead($, await locateFile($, readFrom))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: COMMAND, description: 'Show files written, files read and tools run this session' })
    await declareLinks($)
    return next(e)
  })

  on('command.run', { command: COMMAND }, async $ => {
    await $.ui.open({ id: PANE_ID, title: PANE_TITLE })
    return { text: 'Session activity pane opened.' }
  })

  on('ui.press', { plugin: 'project-status', element: 'tools' }, async ($, e, next) => {
    const panes = await $.ui.panes()
    if (panes.some(p => p.id === PANE_ID && !p.isShown)) await $.ui.close({ id: PANE_ID })
    await $.ui.open({ id: PANE_ID, title: PANE_TITLE })
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const input = e as unknown as ToolInput
    const id = e.tool_use_id ?? `call-${Date.now()}-${nextCallId++}`
    await storeRunStart($, {
      id,
      tool: displayToolName(e.tool),
      summary: summarizeCall(e.tool, input),
      status: 'running',
      isSubagent: e.agentId !== undefined,
      startedAt: Date.now(),
    }).catch(() => undefined)

    const ran = await next(e)
    const status = statusOf(ran)
    await storeRunEnd($, id, status).catch(() => undefined)
    if (status === 'ok') await recordFiles($, e.tool, input).catch(() => undefined)
    return ran
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE_ID }, ($, e) => renderPane($, e))

  registerLinks(on)
}

import type { EngineInterface, Register } from 'claude-code'
import { commandLinkId, commandProblem } from './commandRules'
import { settleRunsLostToReload } from './commandRunner'
import { LINKS_PANE_TITLE } from './constants'
import { cleanNote, linkLabel } from './linkRules'
import { collectMentions, flaggedLink } from './linkTargets'
import { renderLinksPane } from './linksView'
import { storeLink } from './store'
import { locateFile } from './tracker'

// Literal here so the engine can match the command, pane and tool by name.
const COMMAND = 'links'
const LINKS_PANE_ID = 'session-links'
const TOOL_NAME = 'link_for_user'
const COMMAND_TOOL_NAME = 'command_for_user'

/** A tab behind another pane comes forward. */
async function raiseLinksPane($: EngineInterface): Promise<void> {
  const panes = await $.ui.panes()
  if (panes.some(p => p.id === LINKS_PANE_ID && !p.isShown)) await $.ui.close({ id: LINKS_PANE_ID })
  await $.ui.open({ id: LINKS_PANE_ID, title: LINKS_PANE_TITLE })
}

/** Called from the mod's one `session.start` hook. */
export async function declareLinks($: EngineInterface): Promise<void> {
  await settleRunsLostToReload($).catch(() => undefined)
  await $.command.register({ name: COMMAND, description: 'Show files and URLs linked this session' })
  await $.tool.register({
    name: TOOL_NAME,
    description:
      "Puts a file or web link in the person's Links pane, for something you want them to look at: a result to review, a spot that needs their decision, a generated report. Opens the pane. Skip it for files you merely mention. The target must be an existing file or an http(s) URL.",
    isDeferred: false,
    inputSchema: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'A file path (absolute or relative to the session root) or an http(s) URL.' },
        line: { type: 'integer', minimum: 1, description: 'The line to open a file at.' },
        note: { type: 'string', description: 'One short line on why it is worth their look.' },
      },
      required: ['target'],
    },
  })
  await $.tool.register({
    name: COMMAND_TOOL_NAME,
    description:
      "Attaches a shell command to the person's Links pane for them to run themselves, such as a build or an app launch they want to watch. It does not run it: the person sees it whole, and it runs only if they press Run and then confirm. Runs in bash; you do not see the result unless they share it. Use your own tools for what you need to run yourself.",
    isDeferred: false,
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The bash command, for example `./gradlew :app:run`.' },
        cwd: { type: 'string', description: 'The folder to run it in; the session root when left out.' },
        note: { type: 'string', description: 'One short line on what it does or what to look for.' },
      },
      required: ['command'],
    },
  })
}

/** The answer to a `command_for_user` call: attached, or why it was not. */
async function attachCommand($: EngineInterface, input: { command?: unknown; cwd?: unknown; note?: unknown }): Promise<string | { refused: string }> {
  const command = typeof input.command === 'string' ? input.command.trim() : ''
  const problem = commandProblem(command)
  if (problem !== null) return { refused: `Not attached: ${problem}.` }
  const folder = await locateFile($, typeof input.cwd === 'string' && input.cwd.length > 0 ? input.cwd : '.')
  const cwd = folder.absPath.replace(/\/\.$/, '')
  const stat = await $.fs.stat(cwd).catch(() => null)
  if (stat?.kind !== 'dir') return { refused: `Not attached: ${cwd} is not a folder.` }
  await storeLink($, {
    id: commandLinkId(cwd, command),
    kind: 'command',
    target: command,
    label: command,
    line: null,
    cwd,
    note: cleanNote(input.note),
    source: 'flagged',
    at: Date.now(),
  })
  await raiseLinksPane($).catch(() => undefined)
  return 'Attached to the Links pane. It runs only if the person presses Run and confirms; you will not see the result unless they share it.'
}

const textOf = (content: unknown): string => {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map(block => block as { type?: unknown; text?: unknown })
    .filter(block => block.type === 'text' && typeof block.text === 'string')
    .map(block => block.text)
    .join('\n')
}

export const registerLinks = (on: Parameters<Register>[0]): void => {
  on('command.run', { command: COMMAND }, async $ => {
    await raiseLinksPane($)
    return { text: 'Links pane opened.' }
  })

  on('ui.press', { plugin: 'project-status', element: 'links' }, async ($, e, next) => {
    await raiseLinksPane($)
    return next(e)
  })

  on('tool.call', { tool: 'mcp__session-files__link_for_user' }, async ($, e) => {
    const input = e as unknown as { target?: unknown; line?: unknown; note?: unknown }
    const target = typeof input.target === 'string' ? input.target.trim() : ''
    const line = typeof input.line === 'number' && Number.isInteger(input.line) && input.line > 0 ? input.line : null
    const link = await flaggedLink($, target, line, cleanNote(input.note))
    if (link === null) {
      const text = `Not linked: ${target} is neither an existing file nor an http(s) URL.`
      return { isError: true as const, result: text, text }
    }
    await storeLink($, link)
    await raiseLinksPane($).catch(() => undefined)
    const text = `Linked ${linkLabel(link)} in the Links pane.`
    return { result: text, text }
  })

  on('tool.call', { tool: 'mcp__session-files__command_for_user' }, async ($, e) => {
    const answer = await attachCommand($, e as unknown as { command?: unknown; cwd?: unknown; note?: unknown })
    if (typeof answer === 'string') return { result: answer, text: answer }
    return { isError: true as const, result: answer.refused, text: answer.refused }
  })

  on('session.append', { door: 'response' }, async ($, e, next) => {
    const kept = await next(e)
    if (e.agentId === undefined) {
      await collectMentions($, textOf(e.message.content)).catch(() => undefined)
    }
    return kept
  })

  on('ui.render', { component: 'Pane', requestId: LINKS_PANE_ID }, ($, e) => renderLinksPane($, e))
}

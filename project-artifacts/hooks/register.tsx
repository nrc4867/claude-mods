import type { Register } from 'claude-code'
import { linkToActiveRepo, noteTouchedPath, refreshArtifacts, registerArtifactsPane } from './artifactsPane'
import { refsInCall } from './artifactsRules'
import { ARTIFACTS_COMMAND, DOCS_BATCH_TOOL, LINKING_TOOLS, PATH_FIELDS } from './constants'

const createsDoc = (input: Record<string, unknown>): boolean => {
  const container = input.container
  return typeof container === 'object' && container !== null && 'create' in container
}

const pathIn = (input: Record<string, unknown>): string | null => {
  for (const field of PATH_FIELDS) {
    const value = input[field]
    if (typeof value === 'string' && value !== '') return value
  }
  return null
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: ARTIFACTS_COMMAND,
      description: 'Show the claude.ai artifacts of each repo here, with their open comments',
      immediate: true,
    })
    const started = await next(e)
    void refreshArtifacts($).catch(() => undefined)
    return started
  })

  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    try {
      // A git call only when the path leaves the active repo; it is done before the result goes on.
      const path = e.tool.startsWith('mcp__') ? null : pathIn(e)
      if (path !== null) await noteTouchedPath($, path)

      const isLinking = LINKING_TOOLS.includes(e.tool) || (e.tool === DOCS_BATCH_TOOL && createsDoc(e))
      if (isLinking && 'result' in ran && ran.isError !== true) {
        // The link is stored before the result goes on; the network read that shows it is not waited for.
        if (await linkToActiveRepo($, refsInCall(e.tool, e, ran.result))) {
          void refreshArtifacts($).catch(() => undefined)
        }
      }
    } catch {
      // Linking is a convenience: the call's own result stands.
    }
    return ran
  })

  registerArtifactsPane(on)
}

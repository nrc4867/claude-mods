import type { Register } from 'claude-code'
import { refreshPaneIfOpen, registerBranchPane } from './branchPane'
import { GIT_COMMAND_PATTERN } from './constants'

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'worktrees',
      description: "Show this repo's worktrees: changed files, landed, merge and cleanup",
      immediate: true,
    })
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    await refreshPaneIfOpen($)
    return done
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const ran = await next(e)
    if (GIT_COMMAND_PATTERN.test(e.command)) await refreshPaneIfOpen($)
    return ran
  }).catch(($, e, next) => next(e))

  registerBranchPane(on)
}

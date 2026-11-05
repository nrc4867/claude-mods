import type { Register } from 'claude-code'
import { registerBarPane } from './bar/barPane'
import { loadBarItems } from './bar/barStore'
import { refreshPaneIfOpen, registerBranchPane } from './branchPane'
import { GIT_COMMAND_PATTERN } from './constants'
import { refreshNotes, registerNotesPane } from './notes/notesPane'
import { countToolCall, refreshBar } from './statusBar'
import { registerStatusRow } from './statusRow'

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'worktrees',
      description: "Show this repo's worktrees: changed files, landed, merge and cleanup",
      immediate: true,
    })
    await $.command.register({
      name: 'notes',
      description: "Keep notes on this repo, unsent until you put one in the prompt",
      immediate: true,
    })
    await $.command.register({
      name: 'statusbar',
      description: 'Choose what the status bar shows: reorder, hide, or add a command',
      immediate: true,
    })
    await loadBarItems($).catch(() => undefined)
    const started = await next(e)
    await refreshBar($, true)
    await refreshNotes($).catch(() => undefined)
    return started
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    await refreshBar($, true)
    await refreshPaneIfOpen($)
    await refreshNotes($).catch(() => undefined)
    return done
  })

  on('tool.call', async ($, e, next) => {
    await countToolCall($).catch(() => undefined)
    const ran = await next(e)
    await refreshBar($, e.tool === 'Bash')
    if (e.tool === 'Bash' && GIT_COMMAND_PATTERN.test(e.command)) await refreshPaneIfOpen($)
    return ran
  }).catch(($, e, next) => next(e))

  registerStatusRow(on)
  registerBranchPane(on)
  registerNotesPane(on)
  registerBarPane(on)
}

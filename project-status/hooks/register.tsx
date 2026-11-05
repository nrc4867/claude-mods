import type { EngineInterface, Register } from 'claude-code'
import { registerBarPane } from './bar/barPane'
import { loadBarItems, refreshKnownCommands } from './bar/barStore'
import { COMMANDS_RECHECK_MS } from './constants'
import { countToolCall, refreshBar } from './statusBar'
import { registerStatusRow } from './statusRow'

/** Fills the session's bar values, which start empty after a launch and after a `/clear`. */
const fillBar = async ($: EngineInterface): Promise<void> => {
  await loadBarItems($).catch(() => undefined)
  await refreshBar($, true)
  await refreshKnownCommands($).catch(() => undefined)
  // Mods loading alongside this one may list their commands only after this hook has run.
  $.clock.after(COMMANDS_RECHECK_MS, () => void refreshKnownCommands($).catch(() => undefined))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'statusbar',
      description: 'Choose what the status bar shows: reorder, hide, or add a command',
      immediate: true,
    })
    const started = await next(e)
    await fillBar($)
    return started
  })

  // A `/clear` empties `$.state` and fires no `session.start`.
  on('classic.SessionStart', async ($, e, next) => {
    const started = await next(e)
    if (e.source === 'clear') await fillBar($)
    return started
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    await refreshBar($, true)
    await refreshKnownCommands($).catch(() => undefined)
    return done
  })

  on('tool.call', async ($, e, next) => {
    await countToolCall($).catch(() => undefined)
    const ran = await next(e)
    await refreshBar($, e.tool === 'Bash')
    return ran
  }).catch(($, e, next) => next(e))

  registerStatusRow(on)
  registerBarPane(on)
}

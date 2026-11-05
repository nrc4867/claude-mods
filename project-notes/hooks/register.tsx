import type { Register } from 'claude-code'
import { refreshNotes, registerNotesPane } from './notesPane'

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'notes',
      description: 'Keep notes on this repo, unsent until you put one in the prompt',
      immediate: true,
    })
    const started = await next(e)
    await refreshNotes($).catch(() => undefined)
    return started
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    await refreshNotes($).catch(() => undefined)
    return done
  })

  registerNotesPane(on)
}

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'
import { BAR_PANE_TITLE, STATUS_BAR_STATE_KEY } from '../constants'
import { barSettingsView } from './barSettingsView'
import type { BarSettingsHandlers } from './barSettingsView'
import { commandItem, itemKey, moveItem, parseCommandLine, removeItem, toggleHidden } from './barRules'
import { changeBarItems, readBarItems, recordPublished } from './barStore'

// Literals here so the engine can match the command and pane by name.
const COMMAND = 'statusbar'
const PANE_ID = 'project-status-bar'

const titleDraft = atom({ plugin: 'project-status', key: 'barTitleDraft' } as const, '')
const commandDraft = atom({ plugin: 'project-status', key: 'barCommandDraft' } as const, '')
const notice = atom({ plugin: 'project-status', key: 'barNotice' } as const, null)

const showError = ($: EngineInterface, text: string): Promise<unknown> =>
  update($, notice, () => ({ text, isError: true }))

async function change(
  $: EngineInterface,
  apply: Parameters<typeof changeBarItems>[1],
): Promise<void> {
  try {
    await update($, notice, () => null)
    await changeBarItems($, apply)
  } catch (error) {
    await showError($, error instanceof Error ? error.message : String(error))
  }
}

/** Adds what the form holds, once the session knows the command and the bar lacks it. */
async function addCommand($: EngineInterface): Promise<void> {
  const parsed = parseCommandLine(await read($, commandDraft))
  if (parsed === null) {
    await showError($, 'Name a command to add')
    return
  }
  const known = await $.command.list()
  if (!known.some(one => one.name === parsed.command)) {
    await showError($, `No command /${parsed.command} in this session`)
    return
  }
  const item = commandItem(await read($, titleDraft), parsed.command, parsed.args)
  if ((await readBarItems($)).some(one => itemKey(one) === itemKey(item))) {
    await showError($, `/${parsed.command} is already on the bar`)
    return
  }
  await change($, items => [...items, item])
  await update($, titleDraft, () => '')
  await update($, commandDraft, () => '')
}

/** Opens the settings pane with the keyboard. */
export async function openBarSettings($: EngineInterface): Promise<void> {
  await update($, notice, () => null)
  await $.ui.open({ id: PANE_ID, title: BAR_PANE_TITLE, focus: true })
}

const handlersFor = ($: EngineInterface): BarSettingsHandlers => {
  const quietly = (work: Promise<unknown>): void => void work.catch(() => undefined)
  return {
    move: (key, delta) => quietly(change($, items => moveItem(items, key, delta))),
    toggleHidden: key => quietly(change($, items => toggleHidden(items, key))),
    remove: key => quietly(change($, items => removeItem(items, key))),
    titleChanged: text => quietly(update($, titleDraft, () => text)),
    commandChanged: text => quietly(update($, commandDraft, () => text)),
    add: () => quietly(addCommand($)),
  }
}

export const registerBarPane = (on: Parameters<Register>[0]): void => {
  on('command.run', { command: COMMAND }, async $ => {
    try {
      await openBarSettings($)
      return { text: 'Status bar settings opened.' }
    } catch (error) {
      return { text: `Could not open the status bar settings: ${error instanceof Error ? error.message : String(error)}` }
    }
  })

  // Any mod's write of its `statusBar` value reaches every plugin's hook here; the rest pass through.
  on('state.set', async ($, e, next) => {
    const written = e as unknown as { plugin: string; key: string; value: unknown }
    const result = await next(e)
    if (written.key === STATUS_BAR_STATE_KEY) await recordPublished($, written.plugin, written.value)
    return result
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE_ID }, async ($, e) => {
    const table = $.ui.resolve(e)
    const { Box, Button, Text } = table
    return barSettingsView(
      { Box, Button, Text, Input: 'Input' in table ? table.Input : null },
      {
        items: await readBarItems($),
        title: await read($, titleDraft),
        command: await read($, commandDraft),
        notice: await read($, notice),
      },
      handlersFor($),
    )
  })
}

import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'
import type { BarItem, PublishedItems } from '../../types'
import { BAR_ITEMS_STORE_KEY } from '../constants'
import { defaultItems, normalizeItems, readPublishedItems } from './barRules'

const items = atom({ plugin: 'project-status', key: 'barItems' } as const, defaultItems(), {
  shape: 'bar-items-1',
})
const published = atom({ plugin: 'project-status', key: 'barPublished' } as const, {}, {
  shape: 'bar-published-1',
})

/** The bar's items in order; a drawing that calls this redraws when they change. */
export async function readBarItems($: EngineInterface): Promise<BarItem[]> {
  return read($, items)
}

/** What each mod has published; a drawing that calls this redraws when it changes. */
export async function readPublished($: EngineInterface): Promise<Record<string, PublishedItems>> {
  return read($, published)
}

/** Takes up the person's saved bar; with none saved the defaults stand. */
export async function loadBarItems($: EngineInterface): Promise<void> {
  const stored = await $.store.get(BAR_ITEMS_STORE_KEY)
  await update($, items, () => normalizeItems(stored))
}

/** Applies a change for this session and every later one. */
export async function changeBarItems(
  $: EngineInterface,
  change: (current: readonly BarItem[]) => BarItem[],
): Promise<void> {
  const next = change(await read($, items))
  await update($, items, () => next)
  await $.store.set(BAR_ITEMS_STORE_KEY, next)
}

/** Keeps what a mod just published in its `statusBar` value. */
export async function recordPublished($: EngineInterface, plugin: string, value: unknown): Promise<void> {
  const next = readPublishedItems(value)
  await update($, published, byPlugin => ({ ...byPlugin, [plugin]: next }))
}

/** Runs the item's command as if typed; a toast says so when it cannot run. */
export async function runBarCommand($: EngineInterface, command: string, args: string): Promise<void> {
  try {
    await $.command.run({ command, args })
  } catch (error) {
    $.ui.toast(`Could not run /${command}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

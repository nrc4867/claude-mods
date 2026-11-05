import type { BarItem, BuiltinItemId, PublishedColor, PublishedItem, PublishedItems } from '../../types'
import { PUBLISHED_TEXT_MAX } from '../constants'

/** Each built-in item in its default place. */
export const BUILTIN_ITEMS: readonly BuiltinItemId[] = ['project', 'branch', 'context', 'tools', 'links', 'notes']

/** The command that shows each built-in's mod is installed; pressing the item opens that mod's pane. */
const BUILTIN_COMMANDS: Readonly<Record<BuiltinItemId, string>> = {
  project: 'repos',
  branch: 'worktrees',
  context: 'ctx',
  tools: 'files',
  links: 'links',
  notes: 'notes',
}

const PUBLISHED_COLORS: readonly string[] = ['success', 'warning', 'error', 'suggestion']
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/g

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const defaultItems = (): BarItem[] =>
  BUILTIN_ITEMS.map(id => ({ kind: 'builtin', id, isHidden: false }))

/** What a bar item is known by; a command's arguments are part of it. */
export const itemKey = (item: BarItem): string =>
  item.kind === 'builtin' ? item.id : `command:${item.command} ${item.args}`.trimEnd()

const readItem = (value: unknown): BarItem | null => {
  if (!isRecord(value)) return null
  const isHidden = value.isHidden === true
  if (value.kind === 'builtin') {
    const id = BUILTIN_ITEMS.find(one => one === value.id)
    return id === undefined ? null : { kind: 'builtin', id, isHidden }
  }
  if (value.kind !== 'command' || typeof value.title !== 'string' || typeof value.command !== 'string') return null
  return {
    kind: 'command',
    title: value.title,
    command: value.command,
    args: typeof value.args === 'string' ? value.args : '',
    isHidden,
  }
}

/** The stored list made whole: what cannot be read goes, and a missing built-in joins the end. */
export const normalizeItems = (value: unknown): BarItem[] => {
  const stored = Array.isArray(value) ? value.flatMap(one => readItem(one) ?? []) : []
  const seen = new Set<string>()
  const items = stored.filter(item => {
    const key = itemKey(item)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  const missing = defaultItems().filter(item => !seen.has(itemKey(item)))
  return [...items, ...missing]
}

/** True when the item's command exists in the session; with the commands not yet known, every item counts. */
export const isAvailable = (item: BarItem, known: readonly string[] | null): boolean =>
  known === null || known.includes(item.kind === 'builtin' ? BUILTIN_COMMANDS[item.id] : item.command)

/** Moves the item past its next neighbour that is `shown`, so a step never looks like nothing happened. */
export const moveItem = (
  items: readonly BarItem[],
  key: string,
  delta: number,
  shown: (item: BarItem) => boolean = () => true,
): BarItem[] => {
  const from = items.findIndex(item => itemKey(item) === key)
  const moved = items[from]
  if (moved === undefined) return [...items]
  let to = from + delta
  while (to >= 0 && to < items.length && !shown(items[to] as BarItem)) to += delta
  if (to < 0 || to >= items.length) return [...items]
  const rest = items.filter((_, index) => index !== from)
  return [...rest.slice(0, to), moved, ...rest.slice(to)]
}

export const toggleHidden = (items: readonly BarItem[], key: string): BarItem[] =>
  items.map(item => (itemKey(item) === key ? { ...item, isHidden: !item.isHidden } : item))

export const removeItem = (items: readonly BarItem[], key: string): BarItem[] =>
  items.filter(item => item.kind === 'builtin' || itemKey(item) !== key)

/** Reads `/deploy staging` into its name and arguments; null when it names nothing. */
export const parseCommandLine = (text: string): { command: string; args: string } | null => {
  const match = /^\/?(\S+)\s*(.*)$/s.exec(text.trim())
  const command = match?.[1]
  return command === undefined ? null : { command, args: (match?.[2] ?? '').trim() }
}

/** The command's item; its name stands in for a title left empty. */
export const commandItem = (title: string, command: string, args: string): BarItem => ({
  kind: 'command',
  title: cleanText(title) || command,
  command,
  args,
  isHidden: false,
})

/** One line of bounded text, whatever a mod sent. */
export const cleanText = (text: string): string =>
  text.replace(CONTROL_CHARACTERS, ' ').trim().slice(0, PUBLISHED_TEXT_MAX)

const readPublishedItem = (value: unknown): PublishedItem | null => {
  if (!isRecord(value) || typeof value.text !== 'string') return null
  const text = cleanText(value.text)
  if (text === '') return null
  const color = PUBLISHED_COLORS.find(one => one === value.color) as PublishedColor | undefined
  return color === undefined ? { text } : { text, color }
}

/** Reads what a mod published, by command name; what breaks the format is left out. */
export const readPublishedItems = (value: unknown): PublishedItems => {
  if (!isRecord(value)) return {}
  const items: PublishedItems = {}
  for (const [command, raw] of Object.entries(value)) {
    const item = readPublishedItem(raw)
    if (item !== null) items[command.replace(/^\//, '')] = item
  }
  return items
}

/** What any mod published for the command. */
export const findPublished = (
  byPlugin: Readonly<Record<string, PublishedItems>>,
  command: string,
): PublishedItem | null => {
  for (const items of Object.values(byPlugin)) {
    const item = items[command]
    if (item !== undefined) return item
  }
  return null
}

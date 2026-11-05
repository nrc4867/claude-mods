import type { EngineInterface, Register } from 'claude-code'
import type { BarItem, BuiltinItemId, PublishedItem, PublishedItems, StatusBar } from '../types'
import { openBarSettings } from './bar/barPane'
import { findPublished, isAvailable, itemKey } from './bar/barRules'
import { readBarItems, readKnownCommands, readPublished, runBarCommand } from './bar/barStore'
import {
  BAR_COMMAND,
  BRANCH_ICON,
  COMMAND_ITEM_PREFIX,
  HINT_MARGIN,
  LINKS_COMMAND,
  LINKS_LABEL,
  NOTES_COMMAND,
  NOTES_LABEL,
  SEPARATOR,
} from './constants'
import { readBar, readToolCount } from './statusBar'

const toolsLabel = (count: number): string => `${count} ${count === 1 ? 'tool' : 'tools'}`

/** The built-in items are answered by the mods that own their panes, which hook `ui.press` on these keys. */
const answeredElsewhere = (): void => undefined

type DrawnItem = {
  key: string
  label: string
  color?: PublishedItem['color']
  onPress: () => void
}

/** A built-in showing what its mod published, else its own label. */
const publishedItem = (
  key: BuiltinItemId,
  byPlugin: Readonly<Record<string, PublishedItems>>,
  command: string,
  label: string,
): DrawnItem => {
  const shown = findPublished(byPlugin, command)
  return { key, label: shown?.text ?? label, color: shown?.color, onPress: answeredElsewhere }
}

/** A built-in as it stands now; null when it has nothing to show. */
const builtinItem = (
  id: BuiltinItemId,
  values: StatusBar,
  tools: number,
  byPlugin: Readonly<Record<string, PublishedItems>>,
): DrawnItem | null => {
  switch (id) {
    case 'project':
      return { key: id, label: values.project, onPress: answeredElsewhere }
    case 'branch':
      return values.branch === null
        ? null
        : {
            key: id,
            label: `${BRANCH_ICON} ${values.branch}`,
            onPress: answeredElsewhere,
          }
    case 'context':
      return values.context === null ? null : { key: id, label: values.context, onPress: answeredElsewhere }
    case 'tools':
      return { key: id, label: toolsLabel(tools), onPress: answeredElsewhere }
    case 'links':
      return publishedItem(id, byPlugin, LINKS_COMMAND, LINKS_LABEL)
    case 'notes':
      return publishedItem(id, byPlugin, NOTES_COMMAND, NOTES_LABEL)
  }
}

/** A command's item: what its mod published, else the title the person gave it. */
const commandItemOf = (
  $: EngineInterface,
  item: Extract<BarItem, { kind: 'command' }>,
  byPlugin: Readonly<Record<string, PublishedItems>>,
): DrawnItem => {
  const shown = findPublished(byPlugin, item.command)
  return {
    key: `${COMMAND_ITEM_PREFIX}${itemKey(item)}`,
    label: shown?.text ?? item.title,
    color: shown?.color,
    onPress: () =>
      void (item.command === BAR_COMMAND
        ? openBarSettings($).catch(() => undefined)
        : runBarCommand($, item.command, item.args)),
  }
}

export const registerStatusRow = (on: Parameters<Register>[0]): void => {
  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    const hint = await next(e)
    const values = await readBar($)
    const tools = await readToolCount($)
    const items = await readBarItems($)
    const byPlugin = await readPublished($)
    const known = await readKnownCommands($)
    if (values === null) return hint

    const { Box, Button, Text } = $.ui.resolve(e)
    const drawn = items
      .filter(item => !item.isHidden && isAvailable(item, known))
      .flatMap(item =>
        (item.kind === 'builtin'
          ? builtinItem(item.id, values, tools, byPlugin)
          : commandItemOf($, item, byPlugin)) ?? [],
      )

    return (
      <Box flexDirection="row">
        {drawn.flatMap((item, index) => [
          index > 0 && (
            <Text key={`before:${item.key}`} dimColor>
              {SEPARATOR}
            </Text>
          ),
          item.color === undefined ? (
            <Button key={item.key} plain dimColor label={item.label} onPress={item.onPress} />
          ) : (
            <Button key={item.key} plain label={item.label} onPress={item.onPress}>
              <Text color={item.color}>{item.label}</Text>
            </Button>
          ),
        ])}
        <Box marginLeft={HINT_MARGIN}>{hint}</Box>
      </Box>
    )
  })
}

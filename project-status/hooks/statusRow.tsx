import type { EngineInterface, Register } from 'claude-code'
import type { BarItem, BuiltinItemId, PublishedItem, PublishedItems, StatusBar } from '../types'
import { findPublished, itemKey } from './bar/barRules'
import { readBarItems, readPublished, runBarCommand } from './bar/barStore'
import { openBranchPane } from './branchPane'
import { BRANCH_ICON, COMMAND_ITEM_PREFIX, LINKS_COMMAND, LINKS_LABEL, NOTES_LABEL, SEPARATOR } from './constants'
import { openNotesPane, readWaitingCount } from './notes/notesPane'
import { notesLabel } from './notes/notesRules'
import { readBar, readToolCount } from './statusBar'

const toolsLabel = (count: number): string => `${count} ${count === 1 ? 'tool' : 'tools'}`

/** The project, context, tools and links items are answered by the mods that own those panes. */
const answeredElsewhere = (): void => undefined

type DrawnItem = {
  key: string
  label: string
  color?: PublishedItem['color']
  onPress: () => void
}

/** A built-in as it stands now; null when it has nothing to show. */
const builtinItem = (
  $: EngineInterface,
  id: BuiltinItemId,
  values: StatusBar,
  tools: number,
  notes: number,
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
            onPress: () => void openBranchPane($, null).catch(() => undefined),
          }
    case 'context':
      return values.context === null ? null : { key: id, label: values.context, onPress: answeredElsewhere }
    case 'tools':
      return { key: id, label: toolsLabel(tools), onPress: answeredElsewhere }
    case 'links': {
      const shown = findPublished(byPlugin, LINKS_COMMAND)
      return { key: id, label: shown?.text ?? LINKS_LABEL, color: shown?.color, onPress: answeredElsewhere }
    }
    case 'notes':
      return {
        key: id,
        label: notesLabel(notes, NOTES_LABEL),
        onPress: () => void openNotesPane($).catch(() => undefined),
      }
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
    onPress: () => void runBarCommand($, item.command, item.args),
  }
}

export const registerStatusRow = (on: Parameters<Register>[0]): void => {
  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    const hint = await next(e)
    const values = await readBar($)
    const tools = await readToolCount($)
    const notes = await readWaitingCount($)
    const items = await readBarItems($)
    const byPlugin = await readPublished($)
    if (values === null) return hint

    const { Box, Button, Text } = $.ui.resolve(e)
    const hasHint = e.props.hint.trim() !== ''
    const drawn = items
      .filter(item => !item.isHidden)
      .flatMap(item =>
        (item.kind === 'builtin'
          ? builtinItem($, item.id, values, tools, notes, byPlugin)
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
        {hasHint && drawn.length > 0 && (
          <Text key="before-hint" dimColor>
            {SEPARATOR}
          </Text>
        )}
        {hint}
      </Box>
    )
  })
}

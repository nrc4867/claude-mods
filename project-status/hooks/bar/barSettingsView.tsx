import type { Elements as SurfaceElements } from 'claude-code'
import type { BarItem, Notice } from '../../types'
import { itemKey } from './barRules'

type TerminalElements = SurfaceElements['terminal']

/** A surface without text fields, as on mobile, can reorder and hide but not add. */
type Elements = Pick<TerminalElements, 'Box' | 'Button' | 'Text'> & {
  Input: TerminalElements['Input'] | null
}

export type BarSettingsHandlers = {
  move: (key: string, delta: number) => void
  toggleHidden: (key: string) => void
  remove: (key: string) => void
  titleChanged: (text: string) => void
  commandChanged: (text: string) => void
  add: () => void
}

export type BarSettingsModel = {
  items: readonly BarItem[]
  title: string
  command: string
  notice: Notice | null
}

const commandLine = (item: BarItem): string =>
  item.kind === 'command' ? `/${item.command} ${item.args}`.trimEnd() : ''

const itemName = (item: BarItem): string => (item.kind === 'builtin' ? item.id : item.title)

const itemRow = ({ Box, Button, Text }: Elements, item: BarItem, handlers: BarSettingsHandlers) => {
  const key = itemKey(item)
  return (
    <Box key={`row:${key}`} flexDirection="row" gap={1}>
      <Button key={`up:${key}`} label="↑" onPress={() => handlers.move(key, -1)} />
      <Button key={`down:${key}`} label="↓" onPress={() => handlers.move(key, 1)} />
      <Button
        key={`hide:${key}`}
        label={item.isHidden ? 'Show' : 'Hide'}
        onPress={() => handlers.toggleHidden(key)}
      />
      {item.kind === 'command' && (
        <Button key={`remove:${key}`} label="Remove" onPress={() => handlers.remove(key)} />
      )}
      <Text dimColor={item.isHidden} bold={!item.isHidden}>
        {itemName(item)}
      </Text>
      {item.kind === 'command' && <Text dimColor>{commandLine(item)}</Text>}
    </Box>
  )
}

/** The bar's items in order, then the form that adds a command. */
export const barSettingsView = (elements: Elements, model: BarSettingsModel, handlers: BarSettingsHandlers) => {
  const { Box, Button, Input, Text } = elements
  return (
    <Box flexDirection="column">
      {model.notice !== null && (
        <Text color={model.notice.isError ? 'error' : undefined}>{model.notice.text}</Text>
      )}
      {model.items.map(item => itemRow(elements, item, handlers))}
      {Input !== null && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>Add a command</Text>
          <Input
            key="bar-title"
            label="Title"
            placeholder="deploy"
            submitLabel="add"
            value={model.title}
            onInput={handlers.titleChanged}
            onSubmit={handlers.add}
          />
          <Input
            key="bar-command"
            label="Command"
            placeholder="/deploy staging"
            submitLabel="add"
            value={model.command}
            onInput={handlers.commandChanged}
            onSubmit={handlers.add}
          />
          <Button key="bar-add" label="Add" onPress={handlers.add} />
        </Box>
      )}
    </Box>
  )
}

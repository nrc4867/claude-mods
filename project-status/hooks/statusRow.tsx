import type { Register } from 'claude-code'
import { openBranchPane } from './branchPane'
import {
  BRANCH_ICON,
  BRANCH_KEY,
  CONTEXT_KEY,
  LINKS_KEY,
  LINKS_LABEL,
  NOTES_KEY,
  NOTES_LABEL,
  PROJECT_KEY,
  SEPARATOR,
  TOOLS_KEY,
} from './constants'
import { openNotesPane, readWaitingCount } from './notes/notesPane'
import { notesLabel } from './notes/notesRules'
import { readBar, readToolCount } from './statusBar'

const toolsLabel = (count: number): string => `${count} ${count === 1 ? 'tool' : 'tools'}`

/** The project, context, tools and links items are answered by the mods that own those panes. */
const answeredElsewhere = (): void => undefined

export const registerStatusRow = (on: Parameters<Register>[0]): void => {
  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    const hint = await next(e)
    const values = await readBar($)
    const tools = await readToolCount($)
    const notes = await readWaitingCount($)
    if (values === null) return hint

    const { Box, Button, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="row">
        <Button key={PROJECT_KEY} plain dimColor label={values.project} onPress={answeredElsewhere} />
        {values.branch !== null && <Text dimColor>{SEPARATOR}</Text>}
        {values.branch !== null && (
          <Button
            key={BRANCH_KEY}
            plain
            dimColor
            label={`${BRANCH_ICON} ${values.branch}`}
            onPress={() => void openBranchPane($, null).catch(() => undefined)}
          />
        )}
        {values.context !== null && <Text dimColor>{SEPARATOR}</Text>}
        {values.context !== null && (
          <Button key={CONTEXT_KEY} plain dimColor label={values.context} onPress={answeredElsewhere} />
        )}
        <Text dimColor>{SEPARATOR}</Text>
        <Button key={TOOLS_KEY} plain dimColor label={toolsLabel(tools)} onPress={answeredElsewhere} />
        <Text dimColor>{SEPARATOR}</Text>
        <Button key={LINKS_KEY} plain dimColor label={LINKS_LABEL} onPress={answeredElsewhere} />
        <Text dimColor>{SEPARATOR}</Text>
        <Button
          key={NOTES_KEY}
          plain
          dimColor
          label={notesLabel(notes, NOTES_LABEL)}
          onPress={() => void openNotesPane($).catch(() => undefined)}
        />
        <Text dimColor>{SEPARATOR}</Text>
        {hint}
      </Box>
    )
  })
}

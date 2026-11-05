import type { DiffBody, OpenDiff } from '../types'
import { basename } from './formatUtils'

/** The surface's elements, as `$.ui.resolve(e)` hands them to the pane's hook. */
type Elements = { Box: any; Button: any; Code: any; Text: any }

const BODY_MESSAGE: Record<Exclude<DiffBody['kind'], 'hunks'>, string> = {
  binary: 'Binary file.',
  empty: 'No line changes.',
  'too-large': 'Too large to show.',
  failed: 'Could not read the diff.',
}

export function diffView(ui: Elements, opened: OpenDiff, onBack: () => void) {
  const { Box, Button, Code, Text } = ui
  const { body } = opened
  return (
    <Box flexDirection="column">
      <Box flexDirection="row" gap={1}>
        <Button key="diff-back" hotkey="b" label="Back" onPress={onBack} />
        <Text dimColor wrap="truncate-start">
          {basename(opened.worktree)} · {opened.title}
        </Text>
      </Box>
      <Text bold wrap="truncate-start">
        {opened.file.path}
      </Text>
      {body.kind === 'hunks' ? (
        <Code format="diff" source={body.source} path={opened.file.path} />
      ) : (
        <Text dimColor>{BODY_MESSAGE[body.kind]}</Text>
      )}
      {body.kind === 'hunks' && body.shown < body.total && (
        <Text color="warning">
          Showing {body.shown} of {body.total} hunks
        </Text>
      )}
    </Box>
  )
}

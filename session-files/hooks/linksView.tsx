import type { EngineInterface, RenderElement } from 'claude-code'
import type { SessionLink } from '../types'
import { CommandRow } from './commandRow'
import { readArmedCommand, readCommandRuns } from './commandStore'
import { openInEditor } from './editor'
import { linkLabel } from './linkRules'
import type { PaneInput } from './sections'
import { readLinks } from './store'

function LinkRow($: EngineInterface, e: PaneInput, link: SessionLink): RenderElement {
  const { Box, Button, Link, Text } = $.ui.resolve(e)
  return (
    <Box flexDirection="column" key={link.id}>
      {link.kind === 'url' ? (
        <Text wrap="truncate-end">
          <Link href={link.target} label={link.label} />
        </Text>
      ) : (
        <Button
          key={`open:${link.id}`}
          plain
          label={linkLabel(link)}
          onPress={() => void openInEditor($, link.target, link.line)}
        />
      )}
      {link.note !== null && <Text dimColor>  {link.note}</Text>}
    </Box>
  )
}

/** Commands Claude attached, the links it flagged, then the ones its replies named; newest first in each. */
export async function renderLinksPane($: EngineInterface, e: PaneInput): Promise<RenderElement> {
  const { Box, Text } = $.ui.resolve(e)
  const [links, runs, armed] = await Promise.all([readLinks($), readCommandRuns($), readArmedCommand($)])
  const commands = links.filter(link => link.kind === 'command')
  const flagged = links.filter(link => link.source === 'flagged' && link.kind !== 'command')
  const mentioned = links.filter(link => link.source === 'mentioned')

  if (links.length === 0) return <Text dimColor>No links yet.</Text>

  return (
    <Box flexDirection="column">
      {commands.length > 0 && <Text bold>To run <Text dimColor>({commands.length})</Text></Text>}
      {commands.map(link => CommandRow($, e, link, runs[link.id], armed === link.id))}
      {flagged.length > 0 && (
        <Text bold>{commands.length > 0 ? '\n' : ''}To look at <Text dimColor>({flagged.length})</Text></Text>
      )}
      {flagged.map(link => LinkRow($, e, link))}
      {mentioned.length > 0 && (
        <Text bold>{flagged.length + commands.length > 0 ? '\n' : ''}Mentioned <Text dimColor>({mentioned.length})</Text></Text>
      )}
      {mentioned.map(link => LinkRow($, e, link))}
    </Box>
  )
}

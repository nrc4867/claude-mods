import type { EngineInterface, RenderElement, RenderInput, RenderNode } from 'claude-code'
import type { ReadFile, SectionId, TouchedFile, ToolRun, ToolRunStatus } from '../types'
import {
  GLYPH_CLOSED, GLYPH_OPEN, MAX_FILE_LINES, NEAR_LIMIT_LINES, SECTION_EMPTY, SECTION_LABELS,
  TOOL_NAME_COLUMNS,
} from './constants'
import { openInEditor } from './editor'
import { toggleSection } from './store'
import { formatMs } from './stringUtils'

export type PaneInput = RenderInput<'Pane'>

const lineColor = (lines: number): 'error' | 'warning' | undefined =>
  lines > MAX_FILE_LINES ? 'error' : lines > NEAR_LIMIT_LINES ? 'warning' : undefined

const STATUS_GLYPH: Record<ToolRunStatus, string> = { running: '…', ok: '✓', error: '✗', denied: '⊘' }
const STATUS_COLOR: Record<ToolRunStatus, 'warning' | 'success' | 'error' | 'subtle'> = {
  running: 'warning',
  ok: 'success',
  error: 'error',
  denied: 'subtle',
}

/** A section's clickable header: fold glyph, label, count and an optional note. */
export function SectionHeader(
  $: EngineInterface,
  e: PaneInput,
  id: SectionId,
  isOpen: boolean,
  count: number,
  note?: RenderNode,
): RenderElement {
  const { Box, Text, Button } = $.ui.resolve(e)
  return (
    <Box flexDirection="row" key={`head:${id}`}>
      <Button key={`toggle:${id}`} onPress={() => void toggleSection($, id)}>
        <Text bold>
          {isOpen ? GLYPH_OPEN : GLYPH_CLOSED} {SECTION_LABELS[id]} <Text dimColor>({count})</Text>
        </Text>
      </Button>
      {note !== undefined && <Text dimColor wrap="truncate-end"> {note}</Text>}
    </Box>
  )
}

/** The line under an open section: its empty notice, or how many rows did not fit. */
export function SectionFooter(
  $: EngineInterface,
  e: PaneInput,
  id: SectionId,
  count: number,
  shown: number,
): RenderElement | undefined {
  const { Text } = $.ui.resolve(e)
  if (count === 0) return <Text dimColor>  {SECTION_EMPTY[id]}</Text>
  return count > shown ? <Text dimColor>  +{count - shown} more</Text> : undefined
}

function FileRow(
  $: EngineInterface,
  e: PaneInput,
  path: string,
  absPath: string,
  left: RenderNode,
  right: string,
): RenderElement {
  const { Box, Text, Button } = $.ui.resolve(e)
  return (
    <Box flexDirection="row" key={path}>
      <Box width={6}>{left}</Box>
      <Box flexGrow={1}>
        <Button key={`open:${path}`} onPress={() => void openInEditor($, absPath)}>
          <Text wrap="truncate-start">{path}</Text>
        </Button>
      </Box>
      <Text dimColor> {right}</Text>
    </Box>
  )
}

export function WrittenRows($: EngineInterface, e: PaneInput, list: readonly TouchedFile[]): RenderElement[] {
  const { Text } = $.ui.resolve(e)
  return list.map(f =>
    FileRow($, e, f.path, f.absPath, <Text tabular color={lineColor(f.lines)}>{String(f.lines).padStart(5)}</Text>, `×${f.edits}`),
  )
}

export function ReadRows($: EngineInterface, e: PaneInput, list: readonly ReadFile[]): RenderElement[] {
  const { Text } = $.ui.resolve(e)
  return list.map(f => FileRow($, e, f.path, f.absPath, <Text> </Text>, `×${f.reads}`))
}

export function ToolRows($: EngineInterface, e: PaneInput, list: readonly ToolRun[]): RenderElement[] {
  const { Box, Text } = $.ui.resolve(e)
  return list.map(run => (
    <Box flexDirection="row" key={`run:${run.id}`}>
      <Box width={2}>
        <Text color={STATUS_COLOR[run.status]}>{STATUS_GLYPH[run.status]}</Text>
      </Box>
      <Box width={TOOL_NAME_COLUMNS}>
        <Text wrap="truncate-end" dimColor={run.isSubagent}>
          {run.isSubagent ? '↳' : ''}{run.tool}
        </Text>
      </Box>
      <Box flexGrow={1}>
        <Text wrap="truncate-end" dimColor>{run.summary}</Text>
      </Box>
      {run.ms !== undefined && <Text dimColor tabular> {formatMs(run.ms)}</Text>}
    </Box>
  ))
}

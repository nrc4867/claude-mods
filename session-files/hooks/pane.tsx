import type { EngineInterface, RenderElement, RenderNode } from 'claude-code'
import type { SectionId } from '../types'
import { MAX_FILE_LINES, SECTION_ORDER, SUMMARY_ROWS, TOP_TOOLS_SHOWN } from './constants'
import { allocateRows } from './layout'
import type { PaneInput } from './sections'
import { ReadRows, SectionFooter, SectionHeader, ToolRows, WrittenRows } from './sections'
import { readSnapshot } from './store'
import { toolCounts } from './tracker'

/** The whole pane: a summary line, then each section, collapsible. */
export async function renderPane($: EngineInterface, e: PaneInput): Promise<RenderElement> {
  const { Box, Text } = $.ui.resolve(e)
  const { written, read: readList, runs, open } = await readSnapshot($)

  const over = written.filter(f => f.lines > MAX_FILE_LINES).length
  const running = runs.filter(r => r.status === 'running').length
  const failed = runs.filter(r => r.status === 'error').length
  const busiest = toolCounts(runs).slice(0, TOP_TOOLS_SHOWN).map(([tool, n]) => `${tool} ${n}`).join(' · ')

  const counts: Record<SectionId, number> = { written: written.length, read: readList.length, tools: runs.length }
  // Each section keeps its header row, and an open one its footer row.
  const chrome = SUMMARY_ROWS + SECTION_ORDER.reduce((n, id) => n + 1 + (open[id] ? 1 : 0), 0)
  const shown = allocateRows(
    SECTION_ORDER.map(id => ({ count: counts[id], isOpen: open[id] })),
    e.props.scroll.bodyRows - chrome,
  )
  const room = Object.fromEntries(SECTION_ORDER.map((id, i) => [id, shown[i]])) as Record<SectionId, number>

  const rows: Record<SectionId, () => RenderElement[]> = {
    written: () => WrittenRows($, e, written.slice(0, room.written)),
    read: () => ReadRows($, e, readList.slice(0, room.read)),
    tools: () => ToolRows($, e, runs.slice(0, room.tools)),
  }
  const notes: Partial<Record<SectionId, RenderNode>> = {
    written: over > 0 ? <Text color="error">{over} over {MAX_FILE_LINES}</Text> : undefined,
    tools: busiest || undefined,
  }

  return (
    <Box flexDirection="column">
      <Text dimColor>
        {written.length} written · {readList.length} read · {runs.length} calls
        {running > 0 && <Text color="warning"> · {running} running</Text>}
        {failed > 0 && <Text color="error"> · {failed} failed</Text>}
      </Text>
      {SECTION_ORDER.map(id => (
        <Box flexDirection="column" key={`section:${id}`}>
          {SectionHeader($, e, id, open[id], counts[id], notes[id])}
          {open[id] && rows[id]()}
          {open[id] && SectionFooter($, e, id, counts[id], room[id])}
        </Box>
      ))}
    </Box>
  )
}

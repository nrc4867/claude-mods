import type { EngineInterface, RenderElement, RenderInput } from 'claude-code'
import { SHORT_SESSION_ID_CHARS } from './constants'
import { readSessionInfo } from './sessionInfo'

async function copyResume($: EngineInterface, resume: string): Promise<void> {
  const { isCopied } = await $.ui.copy({ text: resume })
  $.ui.toast(isCopied ? `Copied: ${resume}` : resume)
}

/** The pane's first row: this session's id, job folder, transcript and the way back to it. */
export async function SessionRow($: EngineInterface, e: RenderInput<'Pane'>): Promise<RenderElement | null> {
  const { Box, Button, Link, Text } = $.ui.resolve(e)
  const info = await readSessionInfo($)
  if (info === null) return null
  return (
    <Box flexDirection="row" justifyContent="space-between">
      <Text>
        <Text dimColor>Session </Text>
        {info.id.slice(0, SHORT_SESSION_ID_CHARS)}
        {info.job !== null && <Text dimColor> · </Text>}
        {info.job !== null && <Link href={info.job.url} label={`job ${info.job.name}`} />}
        {info.transcriptUrl !== null && <Text dimColor> · </Text>}
        {info.transcriptUrl !== null && <Link href={info.transcriptUrl} label="transcript" />}
      </Text>
      <Button
        key="copy-resume"
        hotkey="c"
        label="Copy resume"
        onPress={() => void copyResume($, info.resume).catch(() => undefined)}
      />
    </Box>
  )
}

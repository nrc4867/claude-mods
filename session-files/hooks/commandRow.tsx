import type { EngineInterface, RenderElement } from 'claude-code'
import type { CommandRun, CommandRunStatus, SessionLink } from '../types'
import { lastLines } from './commandRules'
import { runCommand, stopCommand } from './commandRunner'
import { armCommand } from './commandStore'
import { COMMAND_OUTPUT_LINES } from './constants'
import type { PaneInput } from './sections'
import { formatMs } from './stringUtils'

const STATUS_COLOR: Record<CommandRunStatus, 'warning' | 'success' | 'error' | 'subtle'> = {
  running: 'warning',
  ok: 'success',
  failed: 'error',
  stopped: 'subtle',
}

const statusText = (run: CommandRun): string => {
  if (run.status === 'running') return 'running'
  const took = run.ms === null ? '' : ` · ${formatMs(run.ms)}`
  if (run.status === 'ok') return `done${took}`
  if (run.status === 'stopped') return `stopped${took}`
  return `failed${run.exitCode === null ? '' : ` (exit ${run.exitCode})`}${took}`
}

async function copyText($: EngineInterface, text: string): Promise<void> {
  const { isCopied } = await $.ui.copy({ text })
  $.ui.toast(isCopied ? 'Copied.' : 'Could not reach the clipboard.')
}

/** A command shown whole, so what is confirmed is what runs. */
export function CommandRow(
  $: EngineInterface,
  e: PaneInput,
  link: SessionLink,
  run: CommandRun | undefined,
  isArmed: boolean,
): RenderElement {
  const { Box, Button, Text } = $.ui.resolve(e)
  const isRunning = run?.status === 'running'
  const start = () => {
    void armCommand($, null)
    void runCommand($, link).catch(() => undefined)
  }

  return (
    <Box flexDirection="column" key={link.id}>
      <Text>$ {link.target}</Text>
      <Text dimColor>  in {link.cwd}</Text>
      {link.note !== null && <Text dimColor>  {link.note}</Text>}
      <Box flexDirection="row" gap={1}>
        {isRunning && <Button key={`stop:${link.id}`} label="Stop" onPress={() => stopCommand(link.id)} />}
        {!isRunning && !isArmed && (
          <Button key={`run:${link.id}`} label="Run" onPress={() => void armCommand($, link.id)} />
        )}
        {!isRunning && isArmed && <Button key={`confirm:${link.id}`} label="Confirm run" onPress={start} />}
        {!isRunning && isArmed && (
          <Button key={`cancel:${link.id}`} label="Cancel" onPress={() => void armCommand($, null)} />
        )}
        <Button key={`copy:${link.id}`} label="Copy" onPress={() => void copyText($, link.target).catch(() => undefined)} />
        {run !== undefined && run.output.length > 0 && (
          <Button
            key={`copy-output:${link.id}`}
            label="Copy output"
            onPress={() => void copyText($, run.output).catch(() => undefined)}
          />
        )}
      </Box>
      {run !== undefined && <Text color={STATUS_COLOR[run.status]}>  {statusText(run)}</Text>}
      {run !== undefined && run.output.length > 0 && <Text dimColor>{lastLines(run.output, COMMAND_OUTPUT_LINES)}</Text>}
    </Box>
  )
}

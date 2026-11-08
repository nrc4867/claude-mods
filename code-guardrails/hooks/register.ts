import type { EngineInterface, Register, ToolCallResult } from 'claude-code'
import { fileLengthNote } from './fileLength'
import { historyCommentNote } from './historyComments'
import { testAntiPatternNote } from './testAntiPatterns'

async function withNotes(
  $: EngineInterface,
  ran: ToolCallResult,
  filePath: string,
  added: string,
): Promise<ToolCallResult> {
  if (ran.deny !== undefined || ran.isError === true) return ran

  const notes = [
    historyCommentNote(filePath, added),
    testAntiPatternNote(filePath, added),
    await fileLengthNote($, filePath).catch(() => undefined),
  ].filter((n): n is string => n !== undefined)

  return notes.length === 0 ? ran : { ...ran, context: [...(ran.context ?? []), ...notes] }
}

export const register: Register = on => {
  on('tool.call', { tool: 'Edit' }, async ($, e, next) =>
    withNotes($, await next(e), e.file_path, e.new_string),
  ).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'Write' }, async ($, e, next) =>
    withNotes($, await next(e), e.file_path, e.content),
  ).catch(($, e, next) => next(e))
}

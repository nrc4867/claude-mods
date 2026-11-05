import { MAX_COMMAND_CHARS, MAX_COMMAND_OUTPUT_CHARS } from './constants'

const ANSI_SEQUENCE = /\u001b(?:\[[0-9;?]*[ -/]*[@-~]|\][^\u0007\u001b]*(?:\u0007|\u001b\\)|[@-Z\\^_])/g
const LINE_ENDINGS = /\r\n?/g
const UNDRAWABLE = /[\u0000-\u0008\u000b-\u001f\u007f]/g
/** Control and invisible formatting characters: they could make the command drawn differ from the one run. */
const HIDDEN_IN_COMMAND = /[\u0000-\u0008\u000b-\u001f\u007f]|\p{Cf}/u

/** Why this command cannot be attached; null when it can. */
export const commandProblem = (command: string): string | null => {
  if (command.length === 0) return 'it is empty'
  if (command.length > MAX_COMMAND_CHARS) return `it is over ${MAX_COMMAND_CHARS} characters`
  if (HIDDEN_IN_COMMAND.test(command)) return 'it holds control or invisible characters'
  return null
}

/** A short stable id for the command in its folder. */
export const commandLinkId = (cwd: string, command: string): string => {
  let hash = 5381
  for (const char of `${cwd}\n${command}`) hash = (Math.imul(hash, 33) + (char.codePointAt(0) ?? 0)) | 0
  return `command:${(hash >>> 0).toString(36)}`
}

/** A child's output as drawable text: colours and cursor moves gone, progress redraws as lines. */
export const cleanOutput = (text: string): string =>
  text.replace(ANSI_SEQUENCE, '').replace(LINE_ENDINGS, '\n').replace(UNDRAWABLE, '')

export const appendOutput = (output: string, piece: string): string =>
  `${output}${piece}`.slice(-MAX_COMMAND_OUTPUT_CHARS)

export const lastLines = (text: string, count: number): string =>
  text.replace(/\n+$/, '').split('\n').slice(-count).join('\n')

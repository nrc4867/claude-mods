import type { EngineInterface } from 'claude-code'
import { IMAGE_COMMAND_TIMEOUT_MS } from './constants'

const NOTHING = 'none'
const SAVED = 'saved'
const FILE_PREFIX = 'file:'
const SIZE = /pixelWidth:\s*(\d+)[\s\S]*pixelHeight:\s*(\d+)/

/**
 * Answers `file:<path>` when the clipboard holds a copied file, whose icon it
 * also holds as a picture; else writes its picture to the path it is given and
 * answers `saved`; else answers `none`.
 */
export const CLIPBOARD_SCRIPT: readonly string[] = [
  'on run argv',
  'try',
  `return "${FILE_PREFIX}" & POSIX path of (the clipboard as «class furl»)`,
  'end try',
  'try',
  'set png to the clipboard as «class PNGf»',
  'on error',
  `return "${NOTHING}"`,
  'end try',
  'set f to open for access (POSIX file (item 1 of argv)) with write permission',
  'set eof of f to 0',
  'write png to f',
  'close access f',
  `return "${SAVED}"`,
  'end run',
]

/** Reads `sips -g pixelWidth -g pixelHeight` into a size. */
export const parseSipsSize = (stdout: string): { width: number; height: number } | null => {
  const match = SIZE.exec(stdout)
  return match === null ? null : { width: Number(match[1]), height: Number(match[2]) }
}

async function run($: EngineInterface, argv: string[]) {
  return $.process.run(argv, { timeoutMs: IMAGE_COMMAND_TIMEOUT_MS })
}

/** Saves the clipboard's picture, or the picture file copied in Finder, as a PNG; null when it holds neither. */
export async function saveMacClipboardImage(
  $: EngineInterface,
  dir: string,
  path: string,
): Promise<{ width: number; height: number } | null> {
  await run($, ['mkdir', '-p', dir])
  const script = CLIPBOARD_SCRIPT.flatMap(line => ['-e', line])
  const read = await run($, ['osascript', ...script, path])
  if (read.exitCode !== 0) throw new Error('Could not read the clipboard')

  const answer = read.stdout.trim()
  if (answer === NOTHING) return null
  if (answer.startsWith(FILE_PREFIX)) {
    const source = answer.slice(FILE_PREFIX.length)
    const converted = await run($, ['sips', '-s', 'format', 'png', source, '--out', path])
    if (converted.exitCode !== 0) return null
  }
  const size = parseSipsSize((await run($, ['sips', '-g', 'pixelWidth', '-g', 'pixelHeight', path])).stdout)
  if (size === null) throw new Error('Could not read the clipboard')
  return size
}

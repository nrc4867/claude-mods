import type { EngineInterface } from 'claude-code'
import type { NoteImage } from '../types'
import {
  IMAGE_COMMAND_TIMEOUT_MS,
  NOTE_IMAGE_CELL_ASPECT,
  NOTE_IMAGE_MAX_COLUMNS,
  NOTE_IMAGE_MAX_ROWS,
} from './constants'
import { saveMacClipboardImage } from './notesMacClipboard'
import { hostPlatform } from './platform'

/** The clipboard script's exit when it holds no picture. */
const NO_IMAGE_EXIT = 3

const IMAGE_SIZE = /(\d+)x(\d+)/

/** A PowerShell single-quoted literal, whatever the path holds. */
export const psQuote = (text: string): string => `'${text.replace(/'/g, "''")}'`

/**
 * Saves the clipboard's picture, or the picture file copied in Explorer, as a
 * PNG and prints its size. Written without double quotes, which argv would escape.
 */
export const clipboardScript = (dir: string, path: string): string =>
  [
    "$ErrorActionPreference='Stop'",
    'Add-Type -AssemblyName System.Windows.Forms,System.Drawing',
    '$i=[Windows.Forms.Clipboard]::GetImage()',
    `if($i -eq $null){$f=[Windows.Forms.Clipboard]::GetFileDropList();if($f.Count -gt 0){try{$i=[Drawing.Image]::FromFile($f[0])}catch{exit ${NO_IMAGE_EXIT}}}}`,
    `if($i -eq $null){exit ${NO_IMAGE_EXIT}}`,
    `[void][IO.Directory]::CreateDirectory(${psQuote(dir)})`,
    `$i.Save(${psQuote(path)},[Drawing.Imaging.ImageFormat]::Png)`,
    "Write-Output ([string]$i.Width+'x'+$i.Height)",
  ].join(';')

export const parseImageSize = (stdout: string): { width: number; height: number } | null => {
  const match = IMAGE_SIZE.exec(stdout)
  return match === null ? null : { width: Number(match[1]), height: Number(match[2]) }
}

/** The cells a picture fills at its own proportions; a terminal cell is about twice as tall as wide. */
export const imageCells = (image: NoteImage, available: number): { columns: number; rows: number } => {
  const columns = Math.max(1, Math.min(available, NOTE_IMAGE_MAX_COLUMNS))
  const rows = Math.max(1, Math.round((columns * image.height) / image.width / NOTE_IMAGE_CELL_ASPECT))
  if (rows <= NOTE_IMAGE_MAX_ROWS) return { columns, rows }
  const fitted = Math.round((NOTE_IMAGE_MAX_ROWS * NOTE_IMAGE_CELL_ASPECT * image.width) / image.height)
  return { columns: Math.max(1, Math.min(columns, fitted)), rows: NOTE_IMAGE_MAX_ROWS }
}

async function runPowerShell($: EngineInterface, script: string) {
  return $.process.run(['powershell.exe', '-NoProfile', '-NonInteractive', '-STA', '-Command', script], {
    timeoutMs: IMAGE_COMMAND_TIMEOUT_MS,
  })
}

/** Saves the clipboard's picture under `dir`; null when it holds none. */
export async function saveClipboardImage($: EngineInterface, dir: string, at: number): Promise<NoteImage | null> {
  const file = `${at}.png`
  const path = `${dir}/${file}`
  const platform = await hostPlatform($)
  if (platform === 'other') throw new Error('Paste image needs Windows or macOS')
  if (platform === 'mac') {
    const size = await saveMacClipboardImage($, dir, path)
    return size === null ? null : { file, ...size }
  }
  const { exitCode, stdout } = await runPowerShell($, clipboardScript(dir, path))
  if (exitCode === NO_IMAGE_EXIT) return null
  const size = parseImageSize(stdout)
  if (exitCode !== 0 || size === null) throw new Error('Could not read the clipboard')
  return { file, ...size }
}

/** Removes the files; one that will not go is left behind, no note names it. */
export async function removeImageFiles($: EngineInterface, paths: readonly string[]): Promise<void> {
  if (paths.length === 0) return
  const remove =
    (await hostPlatform($)) === 'windows'
      ? runPowerShell($, `Remove-Item -LiteralPath ${paths.map(psQuote).join(',')} -Force -ErrorAction SilentlyContinue`)
      : $.process.run(['rm', '-f', '--', ...paths], { timeoutMs: IMAGE_COMMAND_TIMEOUT_MS })
  await remove.catch(() => undefined)
}

/** Opens the picture in the person's image viewer. */
export async function openImageFile($: EngineInterface, path: string): Promise<void> {
  const platform = await hostPlatform($)
  const { exitCode } =
    platform === 'windows'
      ? await runPowerShell($, `Invoke-Item -LiteralPath ${psQuote(path)}`)
      : await $.process.run([platform === 'mac' ? 'open' : 'xdg-open', path], { timeoutMs: IMAGE_COMMAND_TIMEOUT_MS })
  if (exitCode !== 0) throw new Error(`Could not open ${path}`)
}

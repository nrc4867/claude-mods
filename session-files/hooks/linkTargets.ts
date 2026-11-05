import type { EngineInterface } from 'claude-code'
import type { LinkSource, SessionLink } from '../types'
import { fileLinkId, findMentions, isWebUrl, urlLinkId } from './linkRules'
import { storeLink } from './store'
import { locateFile } from './tracker'

const urlLink = (url: string, source: LinkSource, note: string | null): SessionLink => ({
  id: urlLinkId(url),
  kind: 'url',
  target: url,
  label: url,
  line: null,
  cwd: null,
  note,
  source,
  at: Date.now(),
})

/** The link for a real file, or null when `path` names none. */
async function fileLink(
  $: EngineInterface,
  path: string,
  line: number | null,
  source: LinkSource,
  note: string | null,
): Promise<SessionLink | null> {
  const located = await locateFile($, path)
  const stat = await $.fs.stat(located.absPath).catch(() => null)
  if (stat?.kind !== 'file') return null
  return {
    id: fileLinkId(located.absPath, line),
    kind: 'file',
    target: located.absPath,
    label: located.path,
    line,
    cwd: null,
    note,
    source,
    at: Date.now(),
  }
}

/** The link for what the model asked to show: a web URL or a real file. */
export async function flaggedLink(
  $: EngineInterface,
  target: string,
  line: number | null,
  note: string | null,
): Promise<SessionLink | null> {
  return isWebUrl(target) ? urlLink(target, 'flagged', note) : fileLink($, target, line, 'flagged', note)
}

/** Files every link a reply names; a reference to no real file is left out. */
export async function collectMentions($: EngineInterface, text: string): Promise<void> {
  const { urls, files } = findMentions(text)
  for (const url of urls) await storeLink($, urlLink(url, 'mentioned', null))
  for (const { path, line } of files) {
    const link = await fileLink($, path, line, 'mentioned', null)
    if (link !== null) await storeLink($, link)
  }
}

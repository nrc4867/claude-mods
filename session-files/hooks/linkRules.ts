import type { SessionLink } from '../types'
import { MAX_LINK_NOTE_CHARS, MAX_LINKS, MAX_MENTIONS_PER_REPLY, MAX_URL_CHARS } from './constants'
import { oneLine } from './stringUtils'

const URL_IN_TEXT = /https?:\/\/[^\s<>()[\]`"']+/g
const URL_TRAILING_PUNCTUATION = /[.,;:!?*_]+$/
const WHOLE_URL = /^https?:\/\/[^\s\u0000-\u001f\u007f]+$/
const MARKDOWN_TARGET = /\]\(([^()\s]+)\)/g
const FILE_LINE_REFERENCE = /(?<![\w/\\.:-])((?:[A-Za-z]:)?[\w.\\/-]*[\w-]\.[A-Za-z0-9]+):(\d+)/g
const TRAILING_LINE = /^(.*):(\d+)$/
const OTHER_SCHEME = /^[a-z][a-z0-9+.-]+:/i
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/g

export type FileReference = { path: string; line: number | null }
export type Mentions = { urls: string[]; files: FileReference[] }

export const isWebUrl = (text: string): boolean => WHOLE_URL.test(text) && text.length <= MAX_URL_CHARS

/** The note as one line of drawable text; null when nothing is left. */
export const cleanNote = (note: unknown): string | null => {
  if (typeof note !== 'string') return null
  const text = oneLine(note.replace(CONTROL_CHARACTERS, ' '), MAX_LINK_NOTE_CHARS)
  return text.length > 0 ? text : null
}

const unique = <T>(items: readonly T[], keyOf: (item: T) => string): T[] => [
  ...new Map(items.map(item => [keyOf(item), item])).values(),
]

const parseTarget = (target: string): FileReference => {
  const lined = TRAILING_LINE.exec(target)
  return lined === null ? { path: target, line: null } : { path: lined[1] ?? target, line: Number(lined[2]) }
}

/** The web links and candidate file references in a reply; a candidate may name no real file. */
export const findMentions = (text: string): Mentions => {
  const urls = (text.match(URL_IN_TEXT) ?? []).map(url => url.replace(URL_TRAILING_PUNCTUATION, '')).filter(isWebUrl)
  const rest = text.replace(URL_IN_TEXT, ' ')
  const fromMarkdown = [...rest.matchAll(MARKDOWN_TARGET)]
    .map(match => parseTarget(match[1] ?? ''))
    .filter(reference => !OTHER_SCHEME.test(reference.path))
  const fromReferences = [...rest.matchAll(FILE_LINE_REFERENCE)].map(match => ({
    path: match[1] ?? '',
    line: Number(match[2]),
  }))
  return {
    urls: unique(urls, url => url).slice(0, MAX_MENTIONS_PER_REPLY),
    files: unique([...fromMarkdown, ...fromReferences], r => `${r.path}:${r.line}`).slice(0, MAX_MENTIONS_PER_REPLY),
  }
}

export const fileLinkId = (absPath: string, line: number | null): string =>
  `file:${absPath.replace(/\\/g, '/').toLowerCase()}:${line ?? ''}`

export const urlLinkId = (url: string): string => `url:${url}`

/**
 * The list with `link` added at the front. A flag replaces any earlier entry and comes
 * forward; a repeated mention leaves the list as it is, flagged or not.
 */
export const upsertLink = (list: readonly SessionLink[], link: SessionLink): SessionLink[] => {
  const hasEntry = list.some(entry => entry.id === link.id)
  if (hasEntry && link.source === 'mentioned') return [...list]
  return [link, ...list.filter(entry => entry.id !== link.id)].slice(0, MAX_LINKS)
}

export const linkLabel = (link: SessionLink): string =>
  link.line === null ? link.label : `${link.label}:${link.line}`

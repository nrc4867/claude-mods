import type { McpContentBlock } from 'claude-code'
import type { ArtifactRow, LinkMap, RepoSection } from '../types'
import { ARTIFACTS_COMMAND, ARTIFACT_URL_PREFIX, CREATE_FROM_TYPE_TOOL } from './constants'

/** One entry of list_artifacts as the server sends it. */
export type ListedArtifact = {
  slug: string
  title: string
  url: string
  kind: string | null
  updatedAt: number
  isMine: boolean
}

const SLUG_IN_TEXT = /(?<![_a-z])slug\\*"\s*:\s*\\*"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/g
const URL_IN_TEXT = /https:\/\/claude\.ai\/artifact\/[A-Za-z0-9]+/g

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const stringOr = (value: unknown, fallback: string): string => (typeof value === 'string' ? value : fallback)

/** The first text block that parses as a JSON object; null when none does. */
export function jsonOf(content: readonly McpContentBlock[]): Record<string, unknown> | null {
  for (const block of content) {
    if (block.type !== 'text' || typeof block.text !== 'string') continue
    try {
      const parsed: unknown = JSON.parse(block.text)
      if (isRecord(parsed)) return parsed
    } catch {
      // A notice block, not the result.
    }
  }
  return null
}

function toListed(entry: unknown): ListedArtifact | null {
  if (!isRecord(entry) || typeof entry.slug !== 'string' || entry.soft_deleted === true) return null
  const updated = Date.parse(stringOr(entry.updated_at, ''))
  return {
    slug: entry.slug,
    title: stringOr(entry.title, 'Untitled'),
    url: stringOr(entry.url, ''),
    kind: typeof entry.type_title === 'string' ? entry.type_title : null,
    updatedAt: Number.isNaN(updated) ? 0 : updated,
    isMine: entry.rel === 'mine',
  }
}

/** The artifacts in a list_artifacts result, newest first; null when the result is not one. */
export function parseArtifactList(content: readonly McpContentBlock[]): ListedArtifact[] | null {
  const json = jsonOf(content)
  if (json === null || !Array.isArray(json.artifacts)) return null
  return json.artifacts
    .map(toListed)
    .filter((one): one is ListedArtifact => one !== null)
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

/** Unresolved threads in a read_comments result; null when it holds no threads. */
export function openThreadCount(content: readonly McpContentBlock[]): number | null {
  const json = jsonOf(content)
  if (json === null || !Array.isArray(json.threads)) return null
  return json.threads.filter(thread => isRecord(thread) && thread.resolved_at == null).length
}

/**
 * The slugs and artifact URLs a tool call names, each once. The input counts
 * where its slug is the artifact's own, not a type's as on create_from_type.
 */
export function refsInCall(tool: string, input: unknown, result: unknown): string[] {
  const text = JSON.stringify(tool === CREATE_FROM_TYPE_TOOL ? [result] : [input, result]) ?? ''
  const slugs = [...text.matchAll(SLUG_IN_TEXT)].map(match => match[1] ?? '')
  const urls = text.match(URL_IN_TEXT) ?? []
  return [...new Set([...slugs, ...urls])].filter(ref => ref !== '')
}

export const refMatches = (ref: string, artifact: ListedArtifact): boolean =>
  ref === artifact.slug || (ref.startsWith(ARTIFACT_URL_PREFIX) && ref === artifact.url)

/** The links with each URL ref that a listed artifact answers replaced by its slug. */
export function settleRefs(links: LinkMap, listed: readonly ListedArtifact[]): LinkMap {
  const settled: LinkMap = {}
  for (const [repo, refs] of Object.entries(links)) {
    const named = refs.map(ref => listed.find(one => refMatches(ref, one))?.slug ?? ref)
    settled[repo] = [...new Set(named)]
  }
  return settled
}

export const addRefs = (links: LinkMap, repo: string, refs: readonly string[]): LinkMap => ({
  ...links,
  [repo]: [...new Set([...(links[repo] ?? []), ...refs])],
})

export const removeRef = (links: LinkMap, repo: string, slug: string): LinkMap => ({
  ...links,
  [repo]: (links[repo] ?? []).filter(ref => ref !== slug),
})

/** A stored value read back as links; anything else as none. */
export function parseLinks(value: unknown): LinkMap {
  if (!isRecord(value)) return {}
  const links: LinkMap = {}
  for (const [repo, refs] of Object.entries(value)) {
    if (Array.isArray(refs)) links[repo] = refs.filter((ref): ref is string => typeof ref === 'string')
  }
  return links
}

/** Each linked repo's artifacts, and the user's own that no repo holds. */
export function groupArtifacts(
  listed: readonly ListedArtifact[],
  links: LinkMap,
): { byRepo: Map<string, ListedArtifact[]>; unlinked: ListedArtifact[] } {
  const byRepo = new Map<string, ListedArtifact[]>()
  for (const [repo, refs] of Object.entries(links)) {
    const own = listed.filter(one => refs.some(ref => refMatches(ref, one)))
    if (own.length > 0) byRepo.set(repo, own)
  }
  const anyRepo = Object.values(links).flat()
  return { byRepo, unlinked: listed.filter(one => one.isMine && !anyRepo.some(ref => refMatches(ref, one))) }
}

/** The active repo first, then the repo whose artifact changed last. */
export function orderSections(sections: readonly RepoSection[], activeKey: string | null): RepoSection[] {
  const latest = (section: RepoSection): number => Math.max(0, ...section.rows.map(row => row.updatedAt))
  return [...sections].sort((a, b) => {
    if (a.repo.key === activeKey) return -1
    if (b.repo.key === activeKey) return 1
    return latest(b) - latest(a)
  })
}

export const toRow = (artifact: ListedArtifact, openComments: number | null): ArtifactRow => ({
  slug: artifact.slug,
  title: artifact.title,
  url: artifact.url,
  kind: artifact.kind,
  updatedAt: artifact.updatedAt,
  openComments,
})

/** What `To prompt` leaves in the prompt: the title and the link Claude reads it by. */
export const promptText = (row: ArtifactRow): string => `${row.title}: ${row.url}\n`

const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`

/** What the status bar shows: the rows' count and open comments; its own label when there are none. */
export function statusBarValue(linked: readonly ArtifactRow[]): Record<string, { text: string }> {
  if (linked.length === 0) return {}
  const comments = linked.reduce((sum, row) => sum + (row.openComments ?? 0), 0)
  const parts = [plural(linked.length, 'artifact', 'artifacts')]
  if (comments > 0) parts.push(plural(comments, 'comment', 'comments'))
  return { [ARTIFACTS_COMMAND]: { text: parts.join(' · ') } }
}

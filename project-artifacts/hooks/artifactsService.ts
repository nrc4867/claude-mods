import type { EngineInterface } from 'claude-code'
import type { ArtifactsRepo, LinkMap } from '../types'
import { parseArtifactList, openThreadCount, parseLinks } from './artifactsRules'
import type { ListedArtifact } from './artifactsRules'
import { ARTIFACTS_SERVER, COMMENTS_TOOL, LINKS_STORE_KEY, LIST_LIMIT, LIST_TOOL } from './constants'
import { basename } from './formatUtils'
import { gitOut } from './gitRun'

const GIT_DIR_SUFFIX = /\/\.git$/
const BARE_SUFFIX = /\.git$/

const slashes = (path: string): string => path.replace(/\\/g, '/').replace(/\/$/, '')

const errorText = (content: readonly { text?: string }[]): string =>
  content.map(block => block.text ?? '').join(' ').trim() || 'The artifacts server refused the call.'

/** Every artifact the user can open, newest first. Throws with the server's words when it refuses. */
export async function listArtifacts($: EngineInterface): Promise<ListedArtifact[]> {
  const { content, isError } = await $.mcp.call(ARTIFACTS_SERVER, LIST_TOOL, { limit: LIST_LIMIT })
  if (isError) throw new Error(errorText(content))
  const listed = parseArtifactList(content)
  if (listed === null) throw new Error('The artifacts server answered with something other than a list.')
  return listed
}

/** Unresolved comment threads on one artifact; null where the server cannot read them. */
export async function openComments($: EngineInterface, slug: string): Promise<number | null> {
  try {
    const { content, isError } = await $.mcp.call(ARTIFACTS_SERVER, COMMENTS_TOOL, { slug })
    return isError ? null : openThreadCount(content)
  } catch {
    return null
  }
}

/** A repo known only by its shared git folder, as a stored link names it. */
export function repoFromKey(key: string): ArtifactsRepo {
  const isMainCheckout = GIT_DIR_SUFFIX.test(key)
  const dir = isMainCheckout ? key.replace(GIT_DIR_SUFFIX, '') : key
  return { name: isMainCheckout ? basename(dir) : basename(key).replace(BARE_SUFFIX, ''), key, dir }
}

/** The repo holding `dir`, keyed by its shared git folder; null outside a repo. */
export async function resolveRepo($: EngineInterface, dir: string): Promise<ArtifactsRepo | null> {
  const out = await gitOut($, dir, ['rev-parse', '--path-format=absolute', '--git-common-dir', '--show-toplevel'])
  const [key, top] = (out ?? '').split(/\r?\n/).map(line => slashes(line.trim()))
  if (key === undefined || key === '') return null
  const repo = repoFromKey(key)
  return top === undefined || top === '' ? repo : { ...repo, dir: top }
}

/** The repos under the session root: the root's child folders, or its siblings and itself when it is a repo. */
export async function listRepos($: EngineInterface): Promise<ArtifactsRepo[]> {
  const root = slashes(await $.session.root())
  const isRepo = await $.fs.exists(`${root}/.git`)
  const parent = isRepo ? root.slice(0, root.lastIndexOf('/')) || '/' : root
  const folders = (await $.fs.list(parent))
    .filter(entry => entry.kind === 'dir' && !entry.name.startsWith('.'))
    .map(entry => `${parent}/${entry.name}`)
  const repos = await Promise.all(
    folders.map(async folder => ((await $.fs.exists(`${folder}/.git`)) ? resolveRepo($, folder) : null)),
  )
  const seen = new Set<string>()
  return repos.filter((repo): repo is ArtifactsRepo => {
    if (repo === null || seen.has(repo.key)) return false
    seen.add(repo.key)
    return true
  })
}

/** The folder a tool input names, to ask git about: a file's own folder. */
export function folderOf(path: string): string {
  const clean = slashes(path)
  const last = clean.lastIndexOf('/')
  return /\.[^/]+$/.test(clean) && last > 0 ? clean.slice(0, last) : clean
}

export const isUnder = (path: string, dir: string): boolean => {
  const clean = slashes(path).toLowerCase()
  const top = dir.toLowerCase()
  return clean === top || clean.startsWith(`${top}/`)
}

export async function readLinks($: EngineInterface): Promise<LinkMap> {
  return parseLinks(await $.store.get(LINKS_STORE_KEY))
}

/** Applies a change to the links as stored now, which another session may have changed. */
export async function changeLinks($: EngineInterface, change: (links: LinkMap) => LinkMap): Promise<LinkMap> {
  const next = change(await readLinks($))
  await $.store.set(LINKS_STORE_KEY, next)
  return next
}

import type { EngineInterface } from 'claude-code'
import type { RepoScan } from '../types'
import { readRepo } from './gitStatus'
import { joinPath, parentOf, samePath } from './pathUtils'

async function isRepo($: EngineInterface, dir: string): Promise<boolean> {
  return $.fs.exists(joinPath(dir, '.git'))
}

/**
 * Scans the repos beside the session's project: the root's children when the
 * root is a folder of repos, its siblings when the root is a repo itself.
 */
export async function scanRepos($: EngineInterface): Promise<RepoScan> {
  const root = await $.session.root()
  const rootIsRepo = await isRepo($, root)
  const dir = rootIsRepo ? parentOf(root) : root

  const dirs = (await $.fs.list(dir))
    .filter(entry => entry.kind === 'dir' && !entry.name.startsWith('.'))
    .map(entry => joinPath(dir, entry.name))
  const repoDirs = (
    await Promise.all(dirs.map(async d => ((await isRepo($, d)) ? d : null)))
  ).filter((d): d is string => d !== null)

  const repos = await Promise.all(repoDirs.map(d => readRepo($, d)))
  const current = rootIsRepo ? (repos.find(r => samePath(r.path, root))?.path ?? null) : null

  return { dir, current, repos, at: Date.now() }
}

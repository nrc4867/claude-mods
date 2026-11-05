import type { EngineInterface } from 'claude-code'
import type { RepoStatus } from '../types'
import { GIT_TIMEOUT_MS } from './constants'
import { basename } from './pathUtils'

type Parsed = Pick<RepoStatus, 'branch' | 'changes' | 'ahead' | 'behind'>

/** Reads `git status --porcelain=v1 -b` output. */
export const parsePorcelain = (stdout: string): Parsed => {
  const [head = '', ...entries] = stdout.split('\n').filter(l => l.length > 0)
  const ref = head.replace(/^## /, '').replace(/^No commits yet on /, '')
  const branch = ref.split('...')[0]?.split(' ')[0] || null
  const ahead = Number(/\bahead (\d+)/.exec(head)?.[1] ?? 0)
  const behind = Number(/\bbehind (\d+)/.exec(head)?.[1] ?? 0)
  return { branch, changes: entries.length, ahead, behind }
}

export async function readRepo($: EngineInterface, path: string): Promise<RepoStatus> {
  const name = basename(path)
  try {
    const { exitCode, stdout } = await $.process.run(
      ['git', '-C', path, 'status', '--porcelain=v1', '-b'],
      { timeoutMs: GIT_TIMEOUT_MS },
    )
    if (exitCode !== 0) return { name, path, branch: null, changes: 0, ahead: 0, behind: 0 }
    return { name, path, ...parsePorcelain(stdout) }
  } catch {
    return { name, path, branch: null, changes: 0, ahead: 0, behind: 0 }
  }
}

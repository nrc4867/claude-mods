export type RepoStatus = {
  name: string
  path: string
  /** Null when git could not read the repo. */
  branch: string | null
  /** Changed, staged and untracked entries together. */
  changes: number
  ahead: number
  behind: number
}

export type RepoScan = {
  /** The folder whose child repos were scanned. */
  dir: string
  /** The repo the session runs in, when it is one of `repos`. */
  current: string | null
  repos: RepoStatus[]
  /** Epoch ms the scan finished. */
  at: number
}

declare module 'claude-code' {
  interface PluginState {
    'repo-dashboard': { scan: Shaped<RepoScan | null> }
  }
}

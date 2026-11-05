import type { EngineInterface } from 'claude-code'
import { GIT_TIMEOUT_MS } from './constants'

export type GitResult = {
  exitCode: number
  stdout: string
  stderr: string
}

/** Runs git in `cwd`; null when the process could not run or timed out. */
export async function gitRun(
  $: EngineInterface,
  cwd: string,
  args: string[],
  timeoutMs: number = GIT_TIMEOUT_MS,
): Promise<GitResult | null> {
  try {
    const { exitCode, stdout, stderr } = await $.process.run(['git', ...args], { cwd, timeoutMs })
    return { exitCode, stdout, stderr }
  } catch {
    return null
  }
}

/** The stdout of a git command that succeeded; null otherwise. */
export async function gitOut(
  $: EngineInterface,
  cwd: string,
  args: string[],
): Promise<string | null> {
  const result = await gitRun($, cwd, args)
  return result?.exitCode === 0 ? result.stdout : null
}

/** True when the command exits 0; for git's yes-or-no plumbing. */
export async function gitYes(
  $: EngineInterface,
  cwd: string,
  args: string[],
): Promise<boolean> {
  return (await gitRun($, cwd, args))?.exitCode === 0
}

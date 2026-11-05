import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'
import type { StatusBar } from '../types'
import { GIT_TIMEOUT_MS } from './constants'
import { basename, compactTokens } from './formatUtils'

const bar = atom({ plugin: 'project-status', key: 'bar' } as const, null, { shape: 'bar-1' })
const toolCount = atom({ plugin: 'project-status', key: 'toolCount' } as const, 0)

/** The bar's values; a drawing that calls this redraws when they change. */
export async function readBar($: EngineInterface): Promise<StatusBar | null> {
  return read($, bar)
}

/** The session's tool calls so far; a drawing that calls this redraws when it changes. */
export async function readToolCount($: EngineInterface): Promise<number> {
  return read($, toolCount)
}

export async function countToolCall($: EngineInterface): Promise<void> {
  await update($, toolCount, n => n + 1)
}

async function readBranch($: EngineInterface): Promise<string | null> {
  try {
    const { exitCode, stdout } = await $.process.run(
      ['git', 'rev-parse', '--abbrev-ref', 'HEAD'],
      { cwd: await $.session.cwd(), timeoutMs: GIT_TIMEOUT_MS },
    )
    return exitCode === 0 ? stdout.trim() || null : null
  } catch {
    return null
  }
}

async function readContext($: EngineInterface): Promise<string | null> {
  const { context } = await $.session.usage()
  if (context.tokens === undefined || context.percent === undefined) return null
  return `ctx ${context.percent}% (${compactTokens(context.tokens)}/${compactTokens(context.window)})`
}

/** Rereads the bar's values; the branch only when `rereadBranch`, as it takes a process. */
export async function refreshBar($: EngineInterface, rereadBranch: boolean): Promise<void> {
  try {
    const previous = await read($, bar)
    const next = {
      project: basename(await $.session.root()),
      branch: rereadBranch || previous === null ? await readBranch($) : previous.branch,
      context: await readContext($),
    }
    await update($, bar, () => next)
  } catch {
    // The bar is cosmetic: a failed read leaves the previous one up.
  }
}

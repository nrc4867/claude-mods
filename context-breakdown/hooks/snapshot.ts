import type { EngineInterface, SessionRateLimit } from 'claude-code'
import type { ContextRow, ContextSnapshot, RateLimitRow } from '../types'
import { DEFAULT_ROW_COLOR, RATE_LIMIT_LABELS, TOP_MCP_SERVERS, TOP_MEMORY_FILES } from './constants'
import { lastSegment } from './formatUtils'

const byTokens = (a: ContextRow, b: ContextRow): number => b.tokens - a.tokens

const toRateLimitRow = (limit: SessionRateLimit): RateLimitRow => {
  const resets = limit.resetsAt === undefined ? NaN : Date.parse(limit.resetsAt)
  return {
    label: RATE_LIMIT_LABELS[limit.kind] ?? limit.kind,
    percentUsed: limit.percentUsed,
    resetsAt: Number.isNaN(resets) ? null : resets,
  }
}

const sumByServer = (tools: readonly { serverName: string; tokens: number }[]): ContextRow[] => {
  const totals = new Map<string, number>()
  for (const t of tools) totals.set(t.serverName, (totals.get(t.serverName) ?? 0) + t.tokens)
  return [...totals].map(([name, tokens]) => ({ name, tokens, color: DEFAULT_ROW_COLOR }))
}

/** The window's breakdown, estimated locally (no token-count requests). */
export async function takeSnapshot($: EngineInterface): Promise<ContextSnapshot | null> {
  const { context, rateLimits, cost, startedAt } = await $.session.usage({ breakdown: 'summary' })
  const b = context.breakdown
  if (b === undefined) return null

  const categories = b.categories
    .filter(c => (c.kind === 'used' || c.kind === 'buffer') && c.tokens > 0)
    .map(c => ({ name: c.name, tokens: c.tokens, color: c.color }))
    .sort(byTokens)

  return {
    totalTokens: b.totalTokens,
    maxTokens: b.rawMaxTokens,
    percent: b.percentage,
    autoCompactAt: b.isAutoCompactEnabled ? (b.autoCompactThreshold ?? null) : null,
    categories,
    freeTokens: b.categories.filter(c => c.kind === 'free').reduce((n, c) => n + c.tokens, 0),
    memoryFiles: b.memoryFiles
      .map(f => ({ name: lastSegment(f.path), tokens: f.tokens, color: DEFAULT_ROW_COLOR }))
      .sort(byTokens)
      .slice(0, TOP_MEMORY_FILES),
    mcpServers: sumByServer(b.mcpTools.filter(t => t.isLoaded)).sort(byTokens).slice(0, TOP_MCP_SERVERS),
    skillsTokens: b.skills?.tokens ?? 0,
    rateLimits: rateLimits.map(toRateLimitRow),
    costUsd: cost?.usd ?? null,
    startedAt,
    at: Date.now(),
  }
}

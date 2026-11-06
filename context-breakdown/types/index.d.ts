export type ContextRow = {
  name: string
  tokens: number
  /** A theme colour key, as /context draws the row. */
  color: string
}

export type RateLimitRow = {
  /** Display label: "5-hour", "Weekly", or the window's own kind. */
  label: string
  /** 0 to 100, past 100 on an exceeded spend limit. */
  percentUsed: number
  /** Epoch ms the window resets, when reported. */
  resetsAt: number | null
}

export type ContextSnapshot = {
  totalTokens: number
  maxTokens: number
  percent: number
  autoCompactAt: number | null
  /** Categories occupying the window, largest first; free space excluded. */
  categories: ContextRow[]
  freeTokens: number
  /** Largest memory files (CLAUDE.md, MEMORY.md, ...), largest first. */
  memoryFiles: ContextRow[]
  /** MCP tool schemas summed per server, largest first. */
  mcpServers: ContextRow[]
  skillsTokens: number
  /** Subscription windows the last response reported; empty off a subscription. */
  rateLimits: RateLimitRow[]
  /** Session cost in USD, when the host keeps a ledger. */
  costUsd: number | null
  /** Epoch ms the session began. */
  startedAt: number
  /** Epoch ms the snapshot was taken. */
  at: number
}

/** The plan's spend this billing period against the limit set on it. */
export type PlanSpend = {
  used: number
  limit: number
  /** ISO 4217 code: "USD". */
  currency: string
}

export type PlanSpendReading = {
  /** Null when the plan has no spend limit. */
  spend: PlanSpend | null
  /** Epoch ms of the last ask, answered or not. */
  at: number
}

declare module 'claude-code' {
  interface PluginState {
    'context-breakdown': {
      snapshot: Shaped<ContextSnapshot | null>
      planSpend: Shaped<PlanSpendReading | null>
    }
  }
}

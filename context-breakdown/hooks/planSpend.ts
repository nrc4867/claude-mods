import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'
import type { PlanSpend, PlanSpendReading } from '../types'
import {
  DEFAULT_CURRENCY,
  DEFAULT_MINOR_DIGITS,
  PLAN_SPEND_ARGS,
  PLAN_SPEND_MAX_AGE_MS,
  PLAN_SPEND_REQUEST_ID,
  PLAN_SPEND_TIMEOUT_MS,
} from './constants'

const reading = atom({ plugin: 'context-breakdown', key: 'planSpend' } as const, null, { shape: 'plan-spend-1' })
let isAsking = false

type Money = { amount: number; currency: string }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const toAmount = (minor: number, digits: unknown): number =>
  minor / 10 ** (typeof digits === 'number' ? digits : DEFAULT_MINOR_DIGITS)

/** `{ amount_minor, exponent, currency }`, as the usage report writes an amount. */
const readMoney = (value: unknown): Money | null =>
  isRecord(value) && typeof value.amount_minor === 'number'
    ? {
        amount: toAmount(value.amount_minor, value.exponent),
        currency: typeof value.currency === 'string' ? value.currency : DEFAULT_CURRENCY,
      }
    : null

const spendOf = (used: Money, limit: Money): PlanSpend | null =>
  limit.amount > 0 ? { used: used.amount, limit: limit.amount, currency: limit.currency } : null

/** The billing period's spend against its limit, from the usage report's `rate_limits`; null when no limit is set. */
export const readPlanSpend = (rateLimits: unknown): PlanSpend | null => {
  if (!isRecord(rateLimits)) return null
  const spend = rateLimits.spend
  if (isRecord(spend)) {
    const used = readMoney(spend.used)
    const limit = readMoney(spend.limit)
    if (used !== null && limit !== null) return spendOf(used, limit)
  }
  const extra = rateLimits.extra_usage
  if (!isRecord(extra) || typeof extra.monthly_limit !== 'number') return null
  const currency = typeof extra.currency === 'string' ? extra.currency : DEFAULT_CURRENCY
  const used = typeof extra.used_credits === 'number' ? extra.used_credits : 0
  return spendOf(
    { amount: toAmount(used, extra.decimal_places), currency },
    { amount: toAmount(extra.monthly_limit, extra.decimal_places), currency },
  )
}

/** The `rate_limits` of the usage report in a headless run's output; undefined when it holds none. */
export const findRateLimits = (stdout: string): unknown => {
  for (const line of stdout.split('\n')) {
    if (!line.includes(PLAN_SPEND_REQUEST_ID)) continue
    try {
      const message: unknown = JSON.parse(line)
      if (!isRecord(message) || message.type !== 'control_response' || !isRecord(message.response)) continue
      const { response } = message
      if (response.request_id !== PLAN_SPEND_REQUEST_ID || response.subtype !== 'success') continue
      return isRecord(response.response) ? response.response.rate_limits : undefined
    } catch {
      // A line that is not JSON is not the reply.
    }
  }
  return undefined
}

/** Asks a headless Claude Code for the account's usage report, as `/usage` shows it. No model request is made. */
export async function fetchPlanSpend($: EngineInterface): Promise<PlanSpend | null> {
  const request = { type: 'control_request', request_id: PLAN_SPEND_REQUEST_ID, request: { subtype: 'get_usage', skip_behaviors: true } }
  const { stdout } = await $.process.run(PLAN_SPEND_ARGS, {
    stdin: `${JSON.stringify(request)}\n`,
    timeoutMs: PLAN_SPEND_TIMEOUT_MS,
  })
  const rateLimits = findRateLimits(stdout)
  if (rateLimits === undefined) throw new Error('no usage report')
  return readPlanSpend(rateLimits)
}

/** The plan's spend as last read; a drawing that calls this redraws when it changes. */
export async function readPlanSpendReading($: EngineInterface): Promise<PlanSpendReading | null> {
  return read($, reading)
}

/** Asks again when the last answer is stale, or always with `force`; a failed ask keeps the last answer. */
export async function refreshPlanSpend($: EngineInterface, force: boolean): Promise<void> {
  const last = await read($, reading)
  if (isAsking || (!force && last !== null && Date.now() - last.at < PLAN_SPEND_MAX_AGE_MS)) return
  isAsking = true
  try {
    const spend = await fetchPlanSpend($).catch(() => last?.spend ?? null)
    await update($, reading, () => ({ spend, at: Date.now() }))
  } finally {
    isAsking = false
  }
}

import { expect, test } from 'claude-code/testing'
import { findRateLimits, readPlanSpend } from '../hooks/planSpend'

const PANE = {
  plugin: 'context-breakdown',
  component: 'Pane',
  requestId: 'context-breakdown',
  surface: 'terminal',
  props: {
    title: 'Context',
    isFocused: false,
    bodyColumns: 50,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

const USAGE = {
  value: {
    startedAt: Date.now(),
    rateLimits: [],
    context: {
      tokens: 0,
      window: 600_000,
      percent: 0,
      breakdown: {
        categories: [],
        totalTokens: 0,
        maxTokens: 600_000,
        rawMaxTokens: 600_000,
        autocompactSource: 'settings' as const,
        percentage: 0,
        gridRows: [],
        model: 'opus',
        memoryFiles: [],
        mcpTools: [],
        agents: [],
        isAutoCompactEnabled: false,
        apiUsage: null,
      },
    },
  },
}

const usd = (cents: number) => ({ amount_minor: cents, currency: 'USD', exponent: 2 })

/** A headless run's output: its init line, then the control reply holding `rateLimits`. */
const reply = (rateLimits: unknown): string =>
  [
    JSON.stringify({ type: 'system', subtype: 'init' }),
    JSON.stringify({
      type: 'control_response',
      response: { subtype: 'success', request_id: 'context-breakdown-usage', response: { rate_limits: rateLimits } },
    }),
  ].join('\n')

test('the spend limit is read from the usage report, else from extra usage', () => {
  expect(readPlanSpend({ spend: { used: usd(27_140), limit: usd(50_000) } })).toEqual({
    used: 271.4,
    limit: 500,
    currency: 'USD',
  })
  expect(
    readPlanSpend({ extra_usage: { monthly_limit: 50_000, used_credits: 1_000, currency: 'USD', decimal_places: 2 } }),
  ).toEqual({ used: 10, limit: 500, currency: 'USD' })
})

test('a plan with no spend limit has no spend to show', () => {
  expect(
    readPlanSpend({
      spend: { used: usd(0), limit: null },
      extra_usage: { is_enabled: false, monthly_limit: null, used_credits: null },
    }),
  ).toBe(null)
  expect(readPlanSpend(null)).toBe(null)
})

test('the reply is found among the other lines, and output without one has none', () => {
  expect(findRateLimits(reply({ spend: null }))).toEqual({ spend: null })
  expect(findRateLimits('not json\n{"type":"result"}')).toBe(undefined)
})

test('the pane draws the month\'s spend against its limit', async ($, on) => {
  const asked: string[][] = []
  on('session.usage', () => USAGE)
  on('process.run', (_, e) => {
    asked.push([...e.argv])
    return { value: { exitCode: 0, stdout: reply({ spend: { used: usd(45_500), limit: usd(50_000) } }), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })

  const ui = await $.ui.mount(PANE)
  await ui.press({ key: 'refresh' })

  expect(asked[0]?.slice(0, 2)).toEqual(['claude', '-p'])
  expect((await ui.find({ type: 'Text', text: /^Monthly spend/ }))?.text).toBe('Monthly spend $500.00')
  expect((await ui.find({ type: 'Text', text: /^\$455\.00$/ }))?.text).toBe('$455.00')
  const filled = await ui.find({ type: 'Text', text: /█/ })
  expect(filled?.props.color).toBe('error')
  expect(await ui.find({ type: 'Text', text: /No plan limits/ })).toBeUndefined()
  await ui.unmount()
})

test('without a spend limit, or when the ask fails, there is no spend row', async ($, on) => {
  let stdout = reply({ spend: { used: usd(0), limit: null } })
  on('session.usage', () => USAGE)
  on('process.run', () => {
    if (stdout === '') throw new Error('claude not found')
    return { value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })

  const ui = await $.ui.mount(PANE)
  await ui.press({ key: 'refresh' })
  expect(await ui.find({ type: 'Text', text: /^Monthly spend/ })).toBeUndefined()
  expect((await ui.find({ type: 'Text', text: /No plan limits/ }))?.text).toBe('No plan limits reported yet.')

  stdout = ''
  await ui.press({ key: 'refresh' })
  expect(await ui.find({ type: 'Text', text: /^Monthly spend/ })).toBeUndefined()
  await ui.unmount()
})

import { expect, test } from 'claude-code/testing'
import { isTestFile, testAntiPatternNote } from '../hooks/testAntiPatterns'

test('test files are found across build layouts', async () => {
  expect(isTestFile('app/src/test/kotlin/a/FlowTest.kt')).toBe(true)
  expect(isTestFile('ui/src/desktopTest/kotlin/a/B.kt')).toBe(true)
  expect(isTestFile('src/layout.test.ts')).toBe(true)
  expect(isTestFile('app/src/main/kotlin/a/Tooltip.kt')).toBe(false)
})

test('a sleep or waitUntil in a test is noted', async () => {
  expect(testAntiPatternNote('src/test/kotlin/A.kt', 'Thread.sleep(500)')).toContain('wait on the clock')
  expect(testAntiPatternNote('src/test/kotlin/A.kt', 'waitUntil(timeoutMillis = 5_000L) { ready }')).toContain('waitUntil')
  expect(testAntiPatternNote('src/test/kotlin/A.kt', '    delay(SETTLE_MS)')).toContain('delay(SETTLE_MS)')
})

test('the virtual clock and idling are fine', async () => {
  expect(testAntiPatternNote('src/test/kotlin/A.kt', 'mainClock.advanceTimeBy(1000)\nwaitForIdle()')).toBeUndefined()
})

test('reflection that opens private members is noted', async () => {
  expect(testAntiPatternNote('src/test/kotlin/A.kt', 'A::class.java.getDeclaredField("x").apply { isAccessible = true }'))
    .toContain('reflection')
})

test('production code is left alone', async () => {
  expect(testAntiPatternNote('src/main/kotlin/Tooltip.kt', 'delay(500)')).toBeUndefined()
})

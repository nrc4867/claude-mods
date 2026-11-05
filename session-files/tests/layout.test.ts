import { expect, test } from 'claude-code/testing'
import { allocateRows } from '../hooks/layout'

test('rows are shared evenly, spare rows flowing to longer sections', async () => {
  expect(allocateRows([{ count: 2, isOpen: true }, { count: 50, isOpen: true }, { count: 50, isOpen: true }], 20))
    .toEqual([2, 9, 9])
})

test('a collapsed section gets no rows', async () => {
  expect(allocateRows([{ count: 10, isOpen: false }, { count: 10, isOpen: true }], 6)).toEqual([0, 6])
})

test('a negative budget lists nothing', async () => {
  expect(allocateRows([{ count: 3, isOpen: true }], -2)).toEqual([0])
})

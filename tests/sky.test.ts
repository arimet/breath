import { expect, test } from 'vitest'
import { skyAt } from '../src/ui/landscape'

const at = (h: number, m = 0) => skyAt(new Date(2026, 10, 9, h, m))

test('the sky follows the hour, whatever the mode', () => {
  expect([at(4, 59), at(5), at(10, 59), at(11), at(18, 59), at(19), at(23)]).toEqual([
    'night', 'dawn', 'dawn', 'afternoon', 'afternoon', 'night', 'night',
  ])
})

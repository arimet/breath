import { expect, test } from 'vitest'
import { waveShape } from '../src/audio/engine'
import { sleepDim } from '../src/ui/session'

test('the wave swells on the in-breath, ebbs on the out-breath and holds still otherwise', () => {
  const inhale = waveShape('inhale')!
  const exhale = waveShape('exhale')!
  expect(inhale.level).toBeGreaterThan(exhale.level)
  expect(inhale.cutoff).toBeGreaterThan(exhale.cutoff)
  expect(waveShape('inhale2')!.level).toBeGreaterThanOrEqual(inhale.level)
  expect(waveShape('hold')).toBeNull()
  expect(waveShape('holdOut')).toBeNull()
})

test('the sleep screen starts very dark and only darkens towards black', () => {
  const total = 740
  const fadeStart = total - 180
  const levels = [0, 30, fadeStart, fadeStart + 90, total].map((s) => sleepDim(s, total))
  expect(levels[0]).toBeGreaterThanOrEqual(0.8)
  expect(levels[4]).toBe(1)
  levels.slice(1).forEach((l, i) => expect(l).toBeGreaterThanOrEqual(levels[i]))
})

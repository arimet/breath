import { expect, test } from 'vitest'
import type { PhaseKind } from '../src/breath/patterns'
import { breatherScale } from '../src/ui/breather'

const step = (kind: PhaseKind) => ({ kind, start: 0, seconds: 4, cue: true })

test('inhale grows from small to full', () => {
  expect(breatherScale(step('inhale'), 0)).toBeCloseTo(0.5)
  expect(breatherScale(step('inhale'), 1)).toBeCloseTo(1)
  const mid = breatherScale(step('inhale'), 0.5)
  expect(mid).toBeGreaterThan(0.5)
  expect(mid).toBeLessThan(1)
})

test('exhale shrinks from full to small', () => {
  expect(breatherScale(step('exhale'), 0)).toBeCloseTo(1)
  expect(breatherScale(step('exhale'), 1)).toBeCloseTo(0.5)
})

test('holds keep their size', () => {
  for (const p of [0, 0.5, 1]) {
    expect(breatherScale(step('hold'), p)).toBeCloseTo(1)
    expect(breatherScale(step('holdOut'), p)).toBeCloseTo(0.5)
  }
})

test('cyclic sigh fills in two stages', () => {
  const sigh = [{ kind: 'inhale', seconds: 2 }, { kind: 'inhale2', seconds: 1 }] as const
  expect(breatherScale(step('inhale'), 1, sigh[1].kind)).toBeCloseTo(0.85)
  expect(breatherScale(step('inhale2'), 0)).toBeCloseTo(0.85)
  expect(breatherScale(step('inhale2'), 1)).toBeCloseTo(1)
})

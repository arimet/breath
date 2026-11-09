import { describe, expect, test } from 'vitest'
import { clampCustom, phasesFor } from '../src/breath/patterns'
import { buildSleepTimeline, buildTimeline, stepAt } from '../src/breath/timeline'

const DEFAULT_CUSTOM = { inhale: 4, hold: 4, exhale: 4, holdOut: 4 }
const kinds = (t: { steps: { kind: string }[] }, n: number) => t.steps.slice(0, n).map((s) => s.kind)

describe('buildTimeline', () => {
  test('box 5 min ends on a cycle boundary', () => {
    const t = buildTimeline(phasesFor('box', DEFAULT_CUSTOM), { minutes: 5 })
    expect(t.total).toBe(300)
    expect(t.steps).toHaveLength(100)
    expect(kinds(t, 5)).toEqual(['inhale', 'hold', 'exhale', 'holdOut', 'inhale'])
    expect(t.steps.every((s) => s.seconds === 3 && s.cue)).toBe(true)
  })

  test('minutes limit finishes the current cycle', () => {
    const t = buildTimeline(phasesFor('coherence', DEFAULT_CUSTOM), { minutes: 0.95 })
    expect(t.total).toBe(60)
  })

  test('long cycle still runs at least once', () => {
    const phases = phasesFor('custom', { inhale: 10, hold: 10, exhale: 10, holdOut: 10 })
    expect(buildTimeline(phases, { minutes: 1 }).total).toBe(80)
    expect(buildTimeline(phases, { minutes: 0.5 }).total).toBe(40)
  })

  test('478 runs a number of cycles', () => {
    const t = buildTimeline(phasesFor('478', DEFAULT_CUSTOM), { cycles: 4 })
    expect(t.total).toBe(76)
    expect(t.steps).toHaveLength(12)
  })

  test('sigh has two inhales', () => {
    const t = buildTimeline(phasesFor('sigh', DEFAULT_CUSTOM), { minutes: 5 })
    expect(kinds(t, 3)).toEqual(['inhale', 'inhale2', 'exhale'])
    expect(t.steps[3].start).toBe(9)
  })

  test('steps start where the previous one ends', () => {
    const t = buildTimeline(phasesFor('478', DEFAULT_CUSTOM), { cycles: 2 })
    expect(t.steps.map((s) => s.start)).toEqual([0, 4, 11, 19, 23, 30])
  })
})

describe('clampCustom', () => {
  test('clamps out-of-range and invalid values', () => {
    expect(clampCustom({ inhale: 0, hold: 12, exhale: NaN })).toEqual({ inhale: 1, hold: 10, exhale: 4, holdOut: 4 })
  })

  test('zero holds are dropped from the phases', () => {
    const phases = phasesFor('custom', clampCustom({ inhale: 3, hold: 0, exhale: 5, holdOut: 0 }))
    expect(phases).toEqual([
      { kind: 'inhale', seconds: 3 },
      { kind: 'exhale', seconds: 5 },
    ])
  })
})

describe('stepAt', () => {
  const box = buildTimeline(phasesFor('box', DEFAULT_CUSTOM), { minutes: 1 })

  test('finds the step and its progress', () => {
    const at = stepAt(box, 4.5)!
    expect(at.index).toBe(1)
    expect(at.step.kind).toBe('hold')
    expect(at.progress).toBeCloseTo(0.5)
  })

  test('returns null once the session is over', () => {
    expect(stepAt(box, box.total)).toBeNull()
  })
})

describe('buildSleepTimeline', () => {
  const t = buildSleepTimeline()
  const firstHold = t.steps.findIndex((s) => s.kind === 'hold')
  const ramp = t.steps.slice(0, firstHold)
  const free = t.steps.filter((s) => !s.cue)

  test('lasts about 13 minutes', () => {
    expect(t.total).toBeGreaterThanOrEqual(12 * 60)
    expect(t.total).toBeLessThanOrEqual(14 * 60)
  })

  test('ramp slows from 12 to 6 breaths per minute with a 4:6 ratio', () => {
    const cycle = (i: number) => ramp[i].seconds + ramp[i + 1].seconds
    expect(cycle(0)).toBeCloseTo(5, 1)
    expect(cycle(ramp.length - 2)).toBeGreaterThan(9.5)
    expect(ramp[0].seconds / ramp[1].seconds).toBeCloseTo(4 / 6)
    expect(ramp[ramp.length - 2].start).toBeLessThan(300)
  })

  test('then four 4-7-8 cycles', () => {
    const after = t.steps.slice(firstHold - 1, firstHold + 11).map((s) => [s.kind, s.seconds])
    expect(after).toEqual([
      ['inhale', 4], ['hold', 7], ['exhale', 8],
      ['inhale', 4], ['hold', 7], ['exhale', 8],
      ['inhale', 4], ['hold', 7], ['exhale', 8],
      ['inhale', 4], ['hold', 7], ['exhale', 8],
    ])
    expect(t.steps.filter((s) => s.kind === 'hold')).toHaveLength(4)
  })

  test('ends with about 6 minutes of free breathing without cues', () => {
    const duration = free.reduce((sum, s) => sum + s.seconds, 0)
    expect(duration).toBeGreaterThanOrEqual(360)
    expect(duration).toBeLessThanOrEqual(370)
    expect(t.steps[t.steps.length - 1].cue).toBe(false)
  })
})

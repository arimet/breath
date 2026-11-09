import { describe, expect, test } from 'vitest'
import { buildMeditation, cueAt, type MeditationId } from '../src/meditate/scripts'

const IDS: MeditationId[] = ['bodyScan', 'grounding', 'countBreaths', 'timer']

describe.each(IDS)('%s', (id) => {
  const m = buildMeditation(id, 10)

  test('cues are sorted and start with a bell at 0', () => {
    const starts = m.cues.map((c) => c.start)
    expect(starts).toEqual([...starts].sort((a, b) => a - b))
    expect(m.cues[0]).toMatchObject({ start: 0, bell: true })
    expect(m.cues.every((c) => c.start < m.total)).toBe(true)
  })

  test('every cue is written in French and English', () => {
    for (const c of m.cues) {
      expect(c.text.fr.trim()).not.toBe('')
      expect(c.text.en.trim()).not.toBe('')
    }
  })
})

test('body scan lasts about 5 minutes', () => {
  const m = buildMeditation('bodyScan', 10)
  expect(m.total).toBeGreaterThanOrEqual(270)
  expect(m.total).toBeLessThanOrEqual(330)
})

test('grounding lasts about 3 minutes and walks 5, 4, 3, 2, 1 in order', () => {
  const m = buildMeditation('grounding', 10)
  expect(m.total).toBeGreaterThanOrEqual(150)
  expect(m.total).toBeLessThanOrEqual(210)
  const counts = m.cues.map((c) => c.text.fr.match(/^[1-5]\b/)?.[0]).filter(Boolean)
  expect(counts).toEqual(['5', '4', '3', '2', '1'])
})

test('counting breaths lasts about 5 minutes', () => {
  const m = buildMeditation('countBreaths', 10)
  expect(m.total).toBeGreaterThanOrEqual(270)
  expect(m.total).toBeLessThanOrEqual(330)
})

test('timer lasts the chosen minutes with a bell only at the start', () => {
  const m = buildMeditation('timer', 7)
  expect(m.total).toBe(420)
  expect(m.cues.filter((c) => c.bell)).toHaveLength(1)
})

test('timer minutes are clamped to 1-60', () => {
  expect(buildMeditation('timer', 0).total).toBe(60)
  expect(buildMeditation('timer', 99).total).toBe(3600)
})

test('cueAt returns the latest cue started, null once over', () => {
  const m = buildMeditation('grounding', 10)
  expect(cueAt(m, 0)).toBe(m.cues[0])
  expect(cueAt(m, m.cues[1].start + 0.1)).toBe(m.cues[1])
  expect(cueAt(m, m.total)).toBeNull()
})

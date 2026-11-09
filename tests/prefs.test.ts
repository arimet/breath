import { expect, test } from 'vitest'
import { DEFAULT_PREFS, loadPrefs, savePrefs } from '../src/prefs'

function memoryStorage(initial?: string): Storage {
  const data = new Map<string, string>()
  if (initial !== undefined) data.set('breath:prefs', initial)
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
    clear: () => data.clear(),
    key: () => null,
    get length() {
      return data.size
    },
  }
}

const throwing = {
  getItem: () => {
    throw new Error('blocked')
  },
  setItem: () => {
    throw new Error('blocked')
  },
} as unknown as Storage

test('nothing stored gives the defaults', () => {
  expect(loadPrefs(memoryStorage())).toEqual(DEFAULT_PREFS)
})

test('corrupt JSON gives the defaults', () => {
  expect(loadPrefs(memoryStorage('{oops'))).toEqual(DEFAULT_PREFS)
})

test('a throwing storage gives the defaults and saving does not throw', () => {
  expect(loadPrefs(throwing)).toEqual(DEFAULT_PREFS)
  expect(() => savePrefs(DEFAULT_PREFS, throwing)).not.toThrow()
})

test('out-of-range values are clamped', () => {
  const p = loadPrefs(memoryStorage(JSON.stringify({ minutes: { box: 999 }, cycles478: 0, noteVolume: 3, timerMinutes: 90 })))
  expect(p.minutes.box).toBe(20)
  expect(p.minutes.coherence).toBe(5)
  expect(p.cycles478).toBe(1)
  expect(p.noteVolume).toBe(1)
  expect(p.timerMinutes).toBe(60)
})

test('unknown enum values fall back to defaults', () => {
  const p = loadPrefs(memoryStorage(JSON.stringify({ ambience: 'thunder', preset: 'zen', lang: 'de', meditation: 42 })))
  expect(p.ambience).toBe(DEFAULT_PREFS.ambience)
  expect(p.preset).toBe(DEFAULT_PREFS.preset)
  expect(p.lang).toBeNull()
  expect(p.meditation).toBe(DEFAULT_PREFS.meditation)
})

test('saved prefs load back', () => {
  const storage = memoryStorage()
  const p = { ...DEFAULT_PREFS, preset: 'sigh' as const, ambience: 'fire' as const, lang: 'en' as const, warningSeen: true }
  savePrefs(p, storage)
  expect(loadPrefs(storage)).toEqual(p)
})

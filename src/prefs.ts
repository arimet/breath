import { clamp, clampCustom, DEFAULT_CUSTOM, MAX_478_CYCLES, type CustomRhythm, type PresetId } from './breath/patterns'
import type { Lang } from './i18n'
import type { MeditationId } from './meditate/scripts'

export type Ambience = 'none' | 'wind' | 'rain' | 'fire' | 'stream'
export type TimedPreset = 'box' | 'coherence' | 'sigh' | 'custom'

/** Preferences only: nothing about past sessions is stored. */
export interface Prefs {
  preset: PresetId
  minutes: Record<TimedPreset, number>
  cycles478: number
  custom: CustomRhythm
  meditation: MeditationId
  timerMinutes: number
  ambience: Ambience
  sleepAmbience: Ambience
  noteVolume: number
  ambienceVolume: number
  lang: Lang | null
  warningSeen: boolean
}

export const AMBIENCES: Ambience[] = ['none', 'wind', 'rain', 'fire', 'stream']
const PRESET_IDS: PresetId[] = ['box', 'coherence', '478', 'sigh', 'custom']
const MEDITATION_IDS: MeditationId[] = ['bodyScan', 'grounding', 'countBreaths', 'timer']

export const DEFAULT_PREFS: Prefs = {
  preset: 'box',
  minutes: { box: 5, coherence: 5, sigh: 5, custom: 5 },
  cycles478: 4,
  custom: DEFAULT_CUSTOM,
  meditation: 'bodyScan',
  timerMinutes: 10,
  ambience: 'wind',
  sleepAmbience: 'rain',
  noteVolume: 0.6,
  ambienceVolume: 0.5,
  lang: null,
  warningSeen: false,
}

const KEY = 'breath:prefs'

function oneOf<T>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback
}

function volume(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback
}

function defaultStorage(): Storage | undefined {
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}

export function loadPrefs(storage: Storage | undefined = defaultStorage()): Prefs {
  let raw: Record<string, any> = {}
  try {
    const parsed = JSON.parse(storage?.getItem(KEY) ?? '{}')
    if (parsed && typeof parsed === 'object') raw = parsed
  } catch {
    // private mode, blocked storage or corrupt JSON: start from the defaults
  }
  const d = DEFAULT_PREFS
  const minutes = raw.minutes && typeof raw.minutes === 'object' ? raw.minutes : {}
  return {
    preset: oneOf(raw.preset, PRESET_IDS, d.preset),
    minutes: {
      box: clamp(minutes.box, 1, 20, d.minutes.box),
      coherence: clamp(minutes.coherence, 1, 20, d.minutes.coherence),
      sigh: clamp(minutes.sigh, 1, 20, d.minutes.sigh),
      custom: clamp(minutes.custom, 1, 20, d.minutes.custom),
    },
    cycles478: clamp(raw.cycles478, 1, MAX_478_CYCLES, d.cycles478),
    custom: clampCustom(raw.custom && typeof raw.custom === 'object' ? raw.custom : {}),
    meditation: oneOf(raw.meditation, MEDITATION_IDS, d.meditation),
    timerMinutes: clamp(raw.timerMinutes, 1, 60, d.timerMinutes),
    ambience: oneOf(raw.ambience, AMBIENCES, d.ambience),
    sleepAmbience: oneOf(raw.sleepAmbience, AMBIENCES, d.sleepAmbience),
    noteVolume: volume(raw.noteVolume, d.noteVolume),
    ambienceVolume: volume(raw.ambienceVolume, d.ambienceVolume),
    lang: oneOf<Lang | null>(raw.lang, ['fr', 'en'], null),
    warningSeen: raw.warningSeen === true,
  }
}

export function savePrefs(prefs: Prefs, storage: Storage | undefined = defaultStorage()): void {
  try {
    storage?.setItem(KEY, JSON.stringify(prefs))
  } catch {
    // storage full or blocked: preferences just won't survive a reload
  }
}

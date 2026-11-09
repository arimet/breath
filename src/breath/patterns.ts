export type PhaseKind = 'inhale' | 'inhale2' | 'hold' | 'exhale' | 'holdOut'
export interface Phase { kind: PhaseKind; seconds: number }
export type PresetId = 'box' | 'coherence' | '478' | 'sigh' | 'custom'
export interface CustomRhythm { inhale: number; hold: number; exhale: number; holdOut: number }
export type Limit = { minutes: number } | { cycles: number }

export const PRESETS: Record<Exclude<PresetId, 'custom'>, { phases: Phase[]; limit: Limit }> = {
  box: {
    phases: [
      { kind: 'inhale', seconds: 3 },
      { kind: 'hold', seconds: 3 },
      { kind: 'exhale', seconds: 3 },
      { kind: 'holdOut', seconds: 3 },
    ],
    limit: { minutes: 5 },
  },
  coherence: {
    phases: [
      { kind: 'inhale', seconds: 5 },
      { kind: 'exhale', seconds: 5 },
    ],
    limit: { minutes: 5 },
  },
  '478': {
    phases: [
      { kind: 'inhale', seconds: 4 },
      { kind: 'hold', seconds: 7 },
      { kind: 'exhale', seconds: 8 },
    ],
    limit: { cycles: 4 },
  },
  // Cyclic sighing (Balban et al., 2023): a full inhale, a short second sip, a long exhale.
  sigh: {
    phases: [
      { kind: 'inhale', seconds: 2 },
      { kind: 'inhale2', seconds: 1 },
      { kind: 'exhale', seconds: 6 },
    ],
    limit: { minutes: 5 },
  },
}

export const DEFAULT_CUSTOM: CustomRhythm = { inhale: 4, hold: 4, exhale: 4, holdOut: 4 }
export const MAX_478_CYCLES = 8

export function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback
  return Math.min(max, Math.max(min, n))
}

export function clampCustom(r: Partial<CustomRhythm>): CustomRhythm {
  return {
    inhale: clamp(r.inhale, 1, 10, DEFAULT_CUSTOM.inhale),
    hold: clamp(r.hold, 0, 10, DEFAULT_CUSTOM.hold),
    exhale: clamp(r.exhale, 1, 10, DEFAULT_CUSTOM.exhale),
    holdOut: clamp(r.holdOut, 0, 10, DEFAULT_CUSTOM.holdOut),
  }
}

export function phasesFor(id: PresetId, custom: CustomRhythm): Phase[] {
  if (id !== 'custom') return PRESETS[id].phases
  const phases: Phase[] = [
    { kind: 'inhale', seconds: custom.inhale },
    { kind: 'hold', seconds: custom.hold },
    { kind: 'exhale', seconds: custom.exhale },
    { kind: 'holdOut', seconds: custom.holdOut },
  ]
  return phases.filter((p) => p.seconds > 0)
}

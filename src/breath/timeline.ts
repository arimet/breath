import { PRESETS, type Limit, type Phase, type PhaseKind } from './patterns'

/** cue=false: free breathing, no phase note. */
export interface Step { kind: PhaseKind; start: number; seconds: number; cue: boolean }
export interface Timeline { steps: Step[]; total: number }

function push(t: Timeline, phases: Phase[], cue: boolean) {
  for (const p of phases) {
    t.steps.push({ kind: p.kind, start: t.total, seconds: p.seconds, cue })
    t.total += p.seconds
  }
}

/** Whole cycles only: a timed session finishes the cycle in progress. */
export function buildTimeline(phases: Phase[], limit: Limit): Timeline {
  const t: Timeline = { steps: [], total: 0 }
  if ('cycles' in limit) {
    for (let i = 0; i < limit.cycles; i++) push(t, phases, true)
  } else {
    const end = limit.minutes * 60
    while (t.total < end) push(t, phases, true)
  }
  return t
}

const RAMP_SECONDS = 300
const FREE_SECONDS = 360

/** Slow down from 12 to 6 breaths/min, four 4-7-8 cycles, then quiet free breathing. */
export function buildSleepTimeline(): Timeline {
  const t: Timeline = { steps: [], total: 0 }
  while (t.total < RAMP_SECONDS) {
    const cycle = 5 + 5 * (t.total / RAMP_SECONDS)
    push(t, [{ kind: 'inhale', seconds: cycle * 0.4 }, { kind: 'exhale', seconds: cycle * 0.6 }], true)
  }
  for (let i = 0; i < 4; i++) push(t, PRESETS['478'].phases, true)
  const freeStart = t.total
  while (t.total - freeStart < FREE_SECONDS) {
    push(t, [{ kind: 'inhale', seconds: 4 }, { kind: 'exhale', seconds: 6 }], false)
  }
  return t
}

export function stepAt(t: Timeline, seconds: number): { index: number; step: Step; progress: number } | null {
  if (seconds >= t.total || seconds < 0) return null
  // Sessions hold a few hundred steps: a binary search keeps the per-frame lookup cheap anyway.
  let lo = 0
  let hi = t.steps.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (t.steps[mid].start <= seconds) lo = mid
    else hi = mid - 1
  }
  const step = t.steps[lo]
  return { index: lo, step, progress: (seconds - step.start) / step.seconds }
}

import type { PhaseKind } from '../breath/patterns'
import type { Step } from '../breath/timeline'

const EMPTY = 0.5
const FULL = 1
const SIP = 0.85 // where the first inhale of a cyclic sigh stops

const ease = (p: number) => 0.5 - Math.cos(Math.PI * Math.min(1, Math.max(0, p))) / 2

/** Size of the breathing shape. `next` lets an inhale stop short when a second sip follows. */
export function breatherScale(step: Pick<Step, 'kind'>, progress: number, next?: PhaseKind): number {
  const e = ease(progress)
  switch (step.kind) {
    case 'inhale': {
      const top = next === 'inhale2' ? SIP : FULL
      return EMPTY + (top - EMPTY) * e
    }
    case 'inhale2':
      return SIP + (FULL - SIP) * e
    case 'hold':
      return FULL
    case 'exhale':
      return FULL - (FULL - EMPTY) * e
    case 'holdOut':
      return EMPTY
  }
}

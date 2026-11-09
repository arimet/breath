export interface Clock {
  elapsed(): number
  pause(): void
  resume(): void
  readonly paused: boolean
}

/** Session time in seconds that stands still while paused. */
export function createClock(now: () => number = () => performance.now()): Clock {
  let startedAt = now()
  let pausedAt: number | null = null
  return {
    elapsed: () => ((pausedAt ?? now()) - startedAt) / 1000,
    pause() {
      if (pausedAt === null) pausedAt = now()
    },
    resume() {
      if (pausedAt === null) return
      startedAt += now() - pausedAt
      pausedAt = null
    },
    get paused() {
      return pausedAt !== null
    },
  }
}

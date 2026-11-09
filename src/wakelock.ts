let lock: WakeLockSentinel | null = null
let wanted = false

async function acquire(): Promise<boolean> {
  try {
    if (!('wakeLock' in navigator)) return false
    lock = await navigator.wakeLock.request('screen')
    return true
  } catch {
    return false
  }
}

/** Keeps the screen on during a session: iOS stops web audio once the phone locks. */
export function requestWakeLock(): Promise<boolean> {
  wanted = true
  return acquire()
}

export function releaseWakeLock(): void {
  wanted = false
  lock?.release().catch(() => {})
  lock = null
}

if (typeof document !== 'undefined') {
  // The system drops the lock whenever the page is hidden.
  document.addEventListener('visibilitychange', () => {
    if (wanted && document.visibilityState === 'visible') void acquire()
  })
}

import type { PhaseKind } from '../breath/patterns'
import type { Ambience } from '../prefs'

type Sound = Exclude<Ambience, 'none'>

let ctx: AudioContext | null = null
let noteBus: GainNode
let ambienceBus: GainNode // user volume
let ambienceFade: GainNode // session fades (sleep mode, stop)
let current: { name: Sound; source: AudioBufferSourceNode; gain: GainNode } | null = null
const buffers = new Map<Sound, AudioBuffer>()
// Bumped by every start/stop: a load that resolves after a newer request is dropped.
let generation = 0

function getContext(): AudioContext {
  if (ctx) return ctx
  ctx = new AudioContext()
  noteBus = ctx.createGain()
  noteBus.connect(ctx.destination)
  ambienceFade = ctx.createGain()
  ambienceFade.connect(ctx.destination)
  ambienceBus = ctx.createGain()
  ambienceBus.connect(ambienceFade)
  return ctx
}

if (typeof document !== 'undefined') {
  // iOS can leave the context suspended (or silent) after the app comes back to the foreground.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && ctx && ctx.state !== 'running') void ctx.resume()
  })
}

/** Call from a tap: iOS only lets audio start inside a user gesture. */
export async function unlockAudio(): Promise<void> {
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession
  // "playback" keeps sound on when the ring/silent switch is set to silent.
  if (session) session.type = 'playback'
  const c = getContext()
  if (c.state !== 'running') await c.resume()
  const silent = c.createBufferSource()
  silent.buffer = c.createBuffer(1, 1, c.sampleRate)
  silent.connect(c.destination)
  silent.start()
}

/** Unlock, but never block or throw: iOS can leave resume() pending during an interruption. */
export async function unlockAudioWithin(ms: number): Promise<void> {
  await Promise.race([unlockAudio().catch(() => {}), new Promise((r) => setTimeout(r, ms))])
}

export function setVolumes(note: number, ambience: number): void {
  const c = getContext()
  noteBus.gain.setTargetAtTime(note, c.currentTime, 0.05)
  ambienceBus.gain.setTargetAtTime(ambience, c.currentTime, 0.05)
}

// A soft, warm pentatonic palette: rising for the in-breath, falling for the out-breath.
const NOTES: Record<PhaseKind | 'bell', { freq: number; level: number; decay: number }> = {
  inhale: { freq: 392.0, level: 0.22, decay: 1.6 },
  inhale2: { freq: 523.25, level: 0.18, decay: 1.2 },
  hold: { freq: 329.63, level: 0.12, decay: 1.4 },
  exhale: { freq: 293.66, level: 0.2, decay: 2.2 },
  holdOut: { freq: 261.63, level: 0.1, decay: 1.4 },
  bell: { freq: 528, level: 0.22, decay: 5 },
}

export function playCue(kind: PhaseKind | 'bell'): void {
  if (!ctx || ctx.state !== 'running') return
  const { freq, level, decay } = NOTES[kind]
  const t = ctx.currentTime
  const env = ctx.createGain()
  env.gain.setValueAtTime(0, t)
  env.gain.linearRampToValueAtTime(level, t + 0.06)
  env.gain.exponentialRampToValueAtTime(0.0001, t + decay)
  env.connect(noteBus)
  // A bowl-like partial gives the bell its shimmer; phase notes get a faint octave.
  const partials = kind === 'bell' ? [[1, 1], [2.76, 0.35], [5.4, 0.12]] : [[1, 1], [2, 0.15]]
  for (const [ratio, gain] of partials) {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.frequency.value = freq * ratio
    g.gain.value = gain
    osc.connect(g).connect(env)
    osc.start(t)
    osc.stop(t + decay + 0.1)
  }
}

/** null on any failure (offline before the file was ever cached, decode error…): the session goes on without it. */
export async function loadAmbience(name: Sound, fetchImpl: typeof fetch = fetch): Promise<AudioBuffer | null> {
  const cached = buffers.get(name)
  if (cached) return cached
  try {
    const res = await fetchImpl(`sounds/${name}.m4a`)
    if (!res.ok) return null
    const buffer = await getContext().decodeAudioData(await res.arrayBuffer())
    buffers.set(name, buffer)
    return buffer
  } catch {
    return null
  }
}

export async function startAmbience(name: Ambience): Promise<void> {
  const c = getContext()
  ambienceFade.gain.cancelScheduledValues(c.currentTime)
  ambienceFade.gain.setValueAtTime(1, c.currentTime)
  if (current?.name === name) return
  stopAmbience(1)
  const mine = ++generation
  if (name === 'none') return
  const buffer = await loadAmbience(name)
  if (!buffer || mine !== generation) return
  const gain = c.createGain()
  gain.gain.setValueAtTime(0, c.currentTime)
  gain.gain.linearRampToValueAtTime(1, c.currentTime + 2)
  gain.connect(ambienceBus)
  const source = c.createBufferSource()
  source.buffer = buffer
  source.loop = true
  source.connect(gain)
  source.start()
  current = { name, source, gain }
}

function stopAmbience(fadeSeconds: number) {
  if (!ctx || !current) return
  const { source, gain } = current
  const t = ctx.currentTime
  gain.gain.cancelScheduledValues(t)
  gain.gain.setValueAtTime(gain.gain.value, t)
  gain.gain.linearRampToValueAtTime(0, t + fadeSeconds)
  source.stop(t + fadeSeconds + 0.05)
  current = null
}

/** Session-level fade on top of the user's ambience volume (used by sleep mode). */
export function fadeAmbienceTo(level: number, seconds: number): void {
  if (!ctx) return
  const t = ctx.currentTime
  ambienceFade.gain.cancelScheduledValues(t)
  ambienceFade.gain.setValueAtTime(ambienceFade.gain.value, t)
  ambienceFade.gain.linearRampToValueAtTime(level, t + seconds)
}

/*
 * Sleep mode's guide: a soft surf of filtered noise that swells as you breathe in and
 * ebbs as you breathe out, so the breath can be followed with eyes closed.
 */
let wave: { source: AudioBufferSourceNode; filter: BiquadFilterNode; level: GainNode; out: GainNode } | null = null

/** Where the wave heads during a phase; null for holds, where it stays still. */
export function waveShape(kind: PhaseKind): { level: number; cutoff: number } | null {
  if (kind === 'inhale') return { level: 0.5, cutoff: 1300 }
  if (kind === 'inhale2') return { level: 0.6, cutoff: 1700 }
  if (kind === 'exhale') return { level: 0.06, cutoff: 280 }
  return null
}

export function startWave(): void {
  if (!ctx || wave) return
  // Four seconds of pink noise (Paul Kellet's filter), looped.
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  let b0 = 0, b1 = 0, b2 = 0
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1
    b0 = 0.99765 * b0 + white * 0.099046
    b1 = 0.963 * b1 + white * 0.2965164
    b2 = 0.57 * b2 + white * 1.0526913
    data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.2
  }
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.loop = true
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 280
  const level = ctx.createGain()
  level.gain.value = 0.06
  const out = ctx.createGain()
  out.gain.setValueAtTime(0, ctx.currentTime)
  out.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.5)
  source.connect(filter).connect(level).connect(out).connect(noteBus)
  source.start()
  wave = { source, filter, level, out }
}

/** Glides the wave towards a phase's shape over the phase's length. */
export function waveTo(kind: PhaseKind, seconds: number): void {
  const shape = waveShape(kind)
  if (!ctx || !wave || !shape) return
  const t = ctx.currentTime
  // Three time constants reach ~95% of the target by the end of the phase.
  wave.level.gain.setTargetAtTime(shape.level, t, seconds / 3)
  wave.filter.frequency.setTargetAtTime(shape.cutoff, t, seconds / 3)
}

export function stopWave(fadeSeconds: number): void {
  if (!ctx || !wave) return
  const { source, out } = wave
  const t = ctx.currentTime
  out.gain.cancelScheduledValues(t)
  out.gain.setValueAtTime(out.gain.value, t)
  out.gain.linearRampToValueAtTime(0, t + fadeSeconds)
  source.stop(t + fadeSeconds + 0.05)
  wave = null
}

export function stopAll(fadeSeconds = 1): void {
  generation++
  stopAmbience(Math.max(fadeSeconds, 0.05))
  stopWave(Math.max(fadeSeconds, 0.05))
}

import { fadeAmbienceTo, playCue, startAmbience, stopAll } from '../audio/engine'
import { buildSleepTimeline, stepAt, type Timeline } from '../breath/timeline'
import { getLang, t, type Key } from '../i18n'
import { cueAt, type Meditation } from '../meditate/scripts'
import type { Ambience } from '../prefs'
import { createClock } from '../session/clock'
import { releaseWakeLock, requestWakeLock } from '../wakelock'
import { breatherScale } from './breather'
import { icons } from './icons'
import type { Sky } from './landscape'

export type SessionSpec =
  | { kind: 'breath'; timeline: Timeline; ambience: Ambience }
  | { kind: 'meditation'; meditation: Meditation; ambience: Ambience }
  | { kind: 'sleep'; ambience: Ambience }

export type SessionEnd = 'done' | 'stop' | 'dizzy'

export interface Stage {
  root: HTMLElement
  land: { setSky(s: Sky): void; dim(level: number): void }
}

const SLEEP_FADE_SECONDS = 180
// Meditations get a slow, silent 4 s in / 6 s out shape to rest the eyes on.
const MEDITATION_BREATH: Timeline = {
  steps: [
    { kind: 'inhale', start: 0, seconds: 4, cue: false },
    { kind: 'exhale', start: 4, seconds: 6, cue: false },
  ],
  total: 10,
}

const clock2 = (s: number) => {
  const total = Math.max(0, Math.ceil(s))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

function devSpeed(): number {
  if (!import.meta.env.DEV) return 1
  return Number(new URLSearchParams(location.search).get('speed')) || 1
}

export function startSession(stage: Stage, spec: SessionSpec, onEnd: (how: SessionEnd) => void): void {
  const { root, land } = stage
  const timeline = spec.kind === 'breath' ? spec.timeline : spec.kind === 'sleep' ? buildSleepTimeline() : null
  const total = timeline ? timeline.total : (spec as { meditation: Meditation }).meditation.total
  const sleep = spec.kind === 'sleep'
  const fadeStart = total - SLEEP_FADE_SECONDS
  const speed = devSpeed()

  land.setSky(spec.kind === 'breath' ? 'dawn' : spec.kind === 'meditation' ? 'afternoon' : 'night')
  land.dim(0)
  document.documentElement.dataset.session = spec.kind
  root.innerHTML = `
<section class="session ${sleep ? 'is-sleep' : ''}" data-kind="${spec.kind}">
  <header class="s-top">
    <button class="link dizzy" data-act="dizzy">${t('dizzy')}</button>
    <span class="remaining" aria-label="${t('duration')}"></span>
  </header>
  <div class="breather" aria-hidden="true"><div class="ring"></div><div class="orb"><div class="orb-core"></div></div></div>
  <div class="words">
    <p class="phase" aria-live="polite"></p>
    <p class="count"></p>
    <p class="cue-text" aria-live="polite"></p>
  </div>
  <footer class="s-controls">
    <button class="round" data-act="pause" aria-label="${t('pause')}">${icons.pause}</button>
    <button class="round" data-act="stop" aria-label="${t('stop')}">${icons.stop}</button>
  </footer>
  <div class="paused" hidden>
    <p>${t('paused')}</p>
    <button class="primary" data-act="resume">${icons.play}<span>${t('resume')}</span></button>
  </div>
  <p class="toast" hidden></p>
</section>`

  const $ = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!
  const section = $('.session')
  const orb = $('.orb')
  const phase = $('.phase')
  const count = $('.count')
  const cueText = $('.cue-text')
  const remaining = $('.remaining')
  const pausedEl = $('.paused')
  const toast = $('.toast')

  const clock = createClock()
  let raf = 0
  let lastIndex = -1
  let lastCue: unknown = null
  let fading = false
  let finished = false
  const now = () => clock.elapsed() * speed

  void startAmbience(spec.ambience)
  void requestWakeLock().then((ok) => {
    if (ok) return
    toast.textContent = t('keepAwake')
    toast.hidden = false
    setTimeout(() => (toast.hidden = true), 7000)
  })

  function setPhase(key: Key | '') {
    const text = key ? t(key) : ''
    if (phase.textContent !== text) {
      phase.textContent = text
      phase.animate([{ opacity: 0, filter: 'blur(6px)' }, { opacity: 1, filter: 'blur(0)' }], { duration: 600, easing: 'cubic-bezier(.16,1,.3,1)' })
    }
  }

  function frame() {
    const s = now()
    if (s >= total) return finish('done')
    remaining.textContent = clock2(total - s)

    if (timeline) {
      const at = stepAt(timeline, s)!
      const next = timeline.steps[at.index + 1]?.kind
      orb.style.transform = `scale(${breatherScale(at.step, at.progress, next)})`
      if (at.index !== lastIndex) {
        lastIndex = at.index
        if (at.step.cue) playCue(at.step.kind)
      }
      setPhase(at.step.cue ? at.step.kind : 'free')
      count.textContent = at.step.cue ? String(Math.ceil(at.step.seconds * (1 - at.progress))) : ''
    } else {
      const m = (spec as { meditation: Meditation }).meditation
      const at = stepAt(MEDITATION_BREATH, s % MEDITATION_BREATH.total)!
      orb.style.transform = `scale(${breatherScale(at.step, at.progress)})`
      const cue = cueAt(m, s)
      if (cue && cue !== lastCue) {
        lastCue = cue
        if (cue.bell) playCue('bell')
        cueText.textContent = cue.text[getLang()]
        cueText.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 1200, easing: 'cubic-bezier(.16,1,.3,1)' })
      }
    }

    if (sleep && s >= fadeStart) {
      if (!fading) {
        fading = true
        fadeAmbienceTo(0, (total - s) / speed)
      }
      land.dim(Math.min(1, (s - fadeStart) / SLEEP_FADE_SECONDS))
    }
    raf = requestAnimationFrame(frame)
  }

  function pause() {
    if (clock.paused || finished) return
    clock.pause()
    cancelAnimationFrame(raf)
    fadeAmbienceTo(0, 0.6)
    pausedEl.hidden = false
  }

  function resume() {
    if (!clock.paused) return
    clock.resume()
    pausedEl.hidden = true
    const s = now()
    if (sleep && s >= fadeStart) {
      const level = Math.max(0, (total - s) / SLEEP_FADE_SECONDS)
      fadeAmbienceTo(level, 0.8)
      setTimeout(() => !clock.paused && fadeAmbienceTo(0, (total - now()) / speed), 900)
    } else {
      fadeAmbienceTo(1, 1)
    }
    raf = requestAnimationFrame(frame)
  }

  function finish(how: SessionEnd) {
    if (finished) return
    finished = true
    delete document.documentElement.dataset.session
    cancelAnimationFrame(raf)
    document.removeEventListener('visibilitychange', onVisibility)
    if (how === 'done' && !sleep) playCue('bell')
    stopAll(how === 'done' ? 3 : 0.6)
    releaseWakeLock()
    onEnd(how)
  }

  function onVisibility() {
    if (document.visibilityState === 'hidden') pause()
  }
  document.addEventListener('visibilitychange', onVisibility)

  section.addEventListener('click', (e) => {
    const act = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act
    if (act === 'pause') pause()
    else if (act === 'resume') resume()
    else if (act === 'stop') finish('stop')
    else if (act === 'dizzy') finish('dizzy')
    else if (sleep) {
      // Controls stay nearly invisible at night; a tap brings them back for a moment.
      section.classList.add('show-controls')
      setTimeout(() => section.classList.remove('show-controls'), 4000)
    }
  })

  raf = requestAnimationFrame(frame)
}

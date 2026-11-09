import { playCue, setVolumes, unlockAudioWithin } from '../audio/engine'
import { MAX_478_CYCLES, phasesFor, type CustomRhythm, type PresetId } from '../breath/patterns'
import { buildTimeline } from '../breath/timeline'
import { getLang, setLang, t, type Key } from '../i18n'
import { buildMeditation, type MeditationId } from '../meditate/scripts'
import { AMBIENCES, savePrefs, type Ambience, type Prefs } from '../prefs'
import { icons } from './icons'
import { skyAt } from './landscape'
import { startSession, type SessionSpec, type Stage } from './session'

export interface App extends Stage {
  prefs: Prefs
}

type Mode = 'breathe' | 'meditate' | 'sleep'

const PRESETS: PresetId[] = ['box', 'coherence', '478', 'sigh', 'custom']
const MEDITATIONS: MeditationId[] = ['bodyScan', 'grounding', 'countBreaths', 'timer']
const CUSTOM_FIELDS: { field: keyof CustomRhythm; label: Key; min: number }[] = [
  { field: 'inhale', label: 'inhale', min: 1 },
  { field: 'hold', label: 'hold', min: 0 },
  { field: 'exhale', label: 'exhale', min: 1 },
  { field: 'holdOut', label: 'holdOut', min: 0 },
]

function save(app: App) {
  savePrefs(app.prefs)
}

/** Swaps the screen with a short cross-fade; the landscape stays put underneath. */
function show(app: App, html: string, bind: (el: HTMLElement) => void) {
  app.root.innerHTML = html
  const el = app.root.firstElementChild as HTMLElement
  // With a sheet open, the land slides up so the scene stays in view above it.
  document.documentElement.dataset.view = el.classList.contains('with-sheet') ? 'sheet' : 'open'
  bind(el)
  el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 450, easing: 'ease-out' })
  el.querySelector<HTMLElement>('h1, h2')?.focus({ preventScroll: true })
}

function onAct(el: HTMLElement, handlers: Record<string, (target: HTMLElement) => void>) {
  el.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')
    if (target && handlers[target.dataset.act!]) handlers[target.dataset.act!](target)
  })
}

const stepper = (name: string, label: string, value: string) => `
  <div class="stepper" role="group" aria-label="${label}">
    <span class="stepper-label">${label}</span>
    <button class="tick" data-act="step" data-name="${name}" data-delta="-1" aria-label="${t('less')} · ${label}">${icons.minus}</button>
    <output>${value}</output>
    <button class="tick" data-act="step" data-name="${name}" data-delta="1" aria-label="${t('more')} · ${label}">${icons.plus}</button>
  </div>`

/** One watercolour pigment per ambience: [wash, rim where the pigment pools]. */
const PIGMENTS: Record<Ambience, [string, string]> = {
  none: ['#ece6d6', '#a49d8c'],
  wind: ['#a9cbb4', '#5b8f74'],
  rain: ['#93abc9', '#4b6a94'],
  fire: ['#efa75e', '#bf5a2b'],
  stream: ['#79bcc2', '#2b7f8c'],
}

/** A small irregular blot, darker at its rim the way a dried wash is. */
function blot(a: Ambience, seed: number): string {
  let s = seed
  const rand = () => (s = (s * 16807) % 2147483647) / 2147483647
  const pts = Array.from({ length: 9 }, (_, i) => {
    const ang = (i / 9) * Math.PI * 2 + rand() * 0.3
    const r = 11 + (rand() - 0.5) * 5
    return [16 + Math.cos(ang) * r, 16 + Math.sin(ang) * r]
  })
  const mid = (p: number[], q: number[]) => `${((p[0] + q[0]) / 2).toFixed(1)},${((p[1] + q[1]) / 2).toFixed(1)}`
  let d = `M${mid(pts[8], pts[0])}`
  pts.forEach((p, i) => (d += ` Q${p[0].toFixed(1)},${p[1].toFixed(1)} ${mid(p, pts[(i + 1) % 9])}`))
  const [wash, rim] = PIGMENTS[a]
  return `<svg viewBox="0 0 32 32" width="34" height="34" aria-hidden="true">
    <radialGradient id="blot-${a}"><stop offset="0" stop-color="${wash}" stop-opacity="0.75"/><stop offset="0.72" stop-color="${wash}"/><stop offset="1" stop-color="${rim}"/></radialGradient>
    <path d="${d} Z" fill="url(#blot-${a})" stroke="${rim}" stroke-opacity="0.5" stroke-width="0.8"/>
  </svg>`
}

const ambienceBlots = (current: Ambience, legend = t('ambience')) => `
  <fieldset class="blots">
    <legend>${legend}</legend>
    <div class="blots-row">
      ${AMBIENCES.map(
        (a, i) =>
          `<button class="blot" data-act="ambience" data-value="${a}" aria-pressed="${a === current}" aria-label="${t(`amb_${a}` as Key)}">${blot(a, 11 + i * 7)}</button>`,
      ).join('')}
      <span class="blot-name" aria-hidden="true">${t(`amb_${current}` as Key)}</span>
    </div>
  </fieldset>`

/** Marks the chosen blot and writes its name beside the row. */
function pickBlot(el: HTMLElement, chosen: HTMLElement) {
  el.querySelectorAll('[data-act=ambience]').forEach((c) => c.setAttribute('aria-pressed', String(c === chosen)))
  el.querySelector('.blot-name')!.textContent = chosen.getAttribute('aria-label')
}

const sheet = (title: string, body: string, footer = '') => `
<section class="screen with-sheet">
  <div class="sheet" role="dialog" aria-label="${title}">
    <header class="sheet-head">
      <button class="round ghost" data-act="home" aria-label="${t('back')}">${icons.back}</button>
      <h2 tabindex="-1">${title}</h2>
    </header>
    <div class="sheet-body">${body}</div>
    ${footer}
  </div>
</section>`

export function showWarning(app: App, next: () => void) {
  app.land.setScene(skyAt(), app.prefs.ambience)
  show(
    app,
    `<section class="screen warning">
      <div class="sheet">
        <h2 tabindex="-1">${t('warningTitle')}</h2>
        <ul class="precautions">
          ${(['warning1', 'warning2', 'warning3', 'warning4'] as Key[]).map((k) => `<li>${t(k)}</li>`).join('')}
        </ul>
        <button class="go" data-act="ok">${t('warningOk')}</button>
      </div>
    </section>`,
    (el) =>
      onAct(el, {
        ok: () => {
          app.prefs.warningSeen = true
          save(app)
          next()
        },
      }),
  )
}

export function showHome(app: App) {
  app.land.setScene(skyAt(), app.prefs.ambience)
  app.land.dim(0)
  const entry = (mode: Mode, hint: Key) => `
    <li><button class="entry" data-act="mode" data-mode="${mode}">
      <span class="entry-name">${t(mode === 'breathe' ? 'breathe' : mode === 'meditate' ? 'meditate' : 'sleep')}</span>
      <span class="entry-hint">${t(hint)}</span>
    </button></li>`
  show(
    app,
    `<section class="screen home">
      <header class="home-top">
        <h1 tabindex="-1">Breath</h1>
        <button class="round ghost" data-act="settings" aria-label="${t('settings')}">${icons.settings}</button>
      </header>
      <nav class="entries" aria-label="Breath">
        <ul>${entry('breathe', 'breatheHint')}${entry('meditate', 'meditateHint')}${entry('sleep', 'sleepHint')}</ul>
      </nav>
    </section>`,
    (el) =>
      onAct(el, {
        mode: (b) => showChoose(app, b.dataset.mode as Mode),
        settings: () => showSettings(app),
      }),
  )
}

function breathControls(p: Prefs): string {
  const preset = p.preset
  let html = ''
  if (preset === '478') html += stepper('cycles', t('cycles'), String(p.cycles478))
  else html += stepper('minutes', t('duration'), `${p.minutes[preset]} ${t('minutes')}`)
  if (preset === 'custom') {
    html += `<div class="custom">${CUSTOM_FIELDS.map((f) => stepper(`custom:${f.field}`, t(f.label), `${p.custom[f.field]} s`)).join('')}</div>`
  }
  return html
}

function chooseBody(app: App, mode: Mode): string {
  const p = app.prefs
  if (mode === 'sleep') {
    return `<p class="lead">${t('sleepDesc')}</p><p class="tip">${t('sleepTip')}</p>`
  }
  const isBreath = mode === 'breathe'
  const ids: string[] = isBreath ? PRESETS : MEDITATIONS
  const selected = isBreath ? p.preset : p.meditation
  const options = ids
    .map(
      (id) => `
      <li><button class="option" data-act="pick" data-value="${id}" aria-pressed="${id === selected}">
        <span class="option-name">${t((isBreath ? `preset_${id}` : `med_${id}`) as Key)}</span>
        <span class="option-desc">${t((isBreath ? `desc_${id}` : `mdesc_${id}`) as Key)}</span>
      </button></li>`,
    )
    .join('')
  const controls = isBreath
    ? breathControls(p)
    : p.meditation === 'timer'
      ? stepper('timer', t('duration'), `${p.timerMinutes} ${t('minutes')}`)
      : ''
  return `<ol class="options">${options}</ol><div class="controls">${controls}</div>`
}

function specFor(app: App, mode: Mode): SessionSpec {
  const p = app.prefs
  if (mode === 'sleep') return { kind: 'sleep', ambience: p.sleepAmbience }
  if (mode === 'meditate') return { kind: 'meditation', meditation: buildMeditation(p.meditation, p.timerMinutes), ambience: p.ambience }
  const limit = p.preset === '478' ? { cycles: p.cycles478 } : { minutes: p.minutes[p.preset] }
  return { kind: 'breath', timeline: buildTimeline(phasesFor(p.preset, p.custom), limit), ambience: p.ambience }
}

const clampTo = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

export function showChoose(app: App, mode: Mode) {
  const scene = () => app.land.setScene(skyAt(), mode === 'sleep' ? app.prefs.sleepAmbience : app.prefs.ambience)
  scene()
  const title = mode === 'sleep' ? t('sleepTitle') : t(mode === 'breathe' ? 'breathe' : 'meditate')
  const footer = `<footer class="sheet-foot">
    ${ambienceBlots(mode === 'sleep' ? app.prefs.sleepAmbience : app.prefs.ambience)}
    <button class="go" data-act="start">${t('start')}<span aria-hidden="true"> →</span></button>
  </footer>`
  show(app, sheet(title, chooseBody(app, mode), footer), (el) => {
    const body = el.querySelector<HTMLElement>('.sheet-body')!
    const refresh = () => {
      const top = body.scrollTop
      body.innerHTML = chooseBody(app, mode)
      body.scrollTop = top
      save(app)
    }
    const p = app.prefs
    onAct(el, {
      home: () => showHome(app),
      pick: (b) => {
        if (mode === 'breathe') p.preset = b.dataset.value as PresetId
        else p.meditation = b.dataset.value as MeditationId
        refresh()
      },
      ambience: (b) => {
        const a = b.dataset.value as Ambience
        if (mode === 'sleep') p.sleepAmbience = a
        else p.ambience = a
        scene()
        pickBlot(el, b)
        save(app)
      },
      step: (b) => {
        const d = Number(b.dataset.delta)
        const name = b.dataset.name!
        if (name === 'cycles') p.cycles478 = clampTo(p.cycles478 + d, 1, MAX_478_CYCLES)
        else if (name === 'timer') p.timerMinutes = clampTo(p.timerMinutes + d, 1, 60)
        else if (name === 'minutes' && p.preset !== '478') p.minutes[p.preset] = clampTo(p.minutes[p.preset] + d, 1, 20)
        else if (name.startsWith('custom:')) {
          const f = CUSTOM_FIELDS.find((c) => `custom:${c.field}` === name)!
          p.custom = { ...p.custom, [f.field]: clampTo(p.custom[f.field] + d, f.min, 10) }
        }
        refresh()
      },
      start: async (b) => {
        // A second tap while audio unlocks must not start a second session.
        if (b.hasAttribute('aria-busy')) return
        b.setAttribute('aria-busy', 'true')
        await unlockAudioWithin(800)
        setVolumes(p.noteVolume, p.ambienceVolume)
        startSession(app, specFor(app, mode), (how) => {
          if (how === 'dizzy') showDizzy(app)
          else if (how === 'stop') showHome(app)
          else if (mode === 'sleep') showNight(app)
          else showEnd(app)
        })
      },
    })
  })
}

function message(app: App, title: string, text: string) {
  show(
    app,
    `<section class="screen message">
      <div class="message-body">
        <h2 tabindex="-1">${title}</h2>
        <p>${text}</p>
        <button class="primary" data-act="home">${t('home')}</button>
      </div>
    </section>`,
    (el) => onAct(el, { home: () => showHome(app) }),
  )
}

const showEnd = (app: App) => message(app, t('endTitle'), t('endText'))
const showDizzy = (app: App) => message(app, t('dizzyTitle'), t('dizzyText'))

/** Sleep ends on black: no message, no light. A tap goes back home. */
function showNight(app: App) {
  app.land.dim(1)
  app.root.innerHTML = `<section class="screen night-end" aria-label="${t('home')}"></section>`
  app.root.firstElementChild!.addEventListener('click', () => showHome(app), { once: true })
}

export function showSettings(app: App) {
  const p = app.prefs
  const render = () => `
    <div class="setting">
      <span class="setting-label">${t('language')}</span>
      <div class="segmented">
        ${(['fr', 'en'] as const).map((l) => `<button class="chip" data-act="lang" data-value="${l}" aria-pressed="${getLang() === l}">${l === 'fr' ? 'Français' : 'English'}</button>`).join('')}
      </div>
    </div>
    <label class="setting">
      <span class="setting-label">${t('noteVolume')}</span>
      <input type="range" min="0" max="1" step="0.05" value="${p.noteVolume}" data-volume="note" />
    </label>
    <label class="setting">
      <span class="setting-label">${t('ambienceVolume')}</span>
      <input type="range" min="0" max="1" step="0.05" value="${p.ambienceVolume}" data-volume="ambience" />
    </label>
    ${ambienceBlots(p.ambience, t('defaultAmbience'))}
    <button class="link" data-act="warning">${t('rereadWarning')}</button>`

  show(app, sheet(t('settings'), render()), (el) => {
    const body = el.querySelector<HTMLElement>('.sheet-body')!
    onAct(el, {
      home: () => showHome(app),
      lang: (b) => {
        p.lang = b.dataset.value as Prefs['lang']
        setLang(p.lang!)
        save(app)
        showSettings(app)
      },
      ambience: (b) => {
        p.ambience = b.dataset.value as Ambience
        app.land.setScene(skyAt(), p.ambience)
        save(app)
        body.innerHTML = render()
      },
      warning: () => showWarning(app, () => showSettings(app)),
    })
    body.addEventListener('change', async (e) => {
      const input = e.target as HTMLInputElement
      if (!input.dataset.volume) return
      if (input.dataset.volume === 'note') p.noteVolume = Number(input.value)
      else p.ambienceVolume = Number(input.value)
      save(app)
      await unlockAudioWithin(800)
      setVolumes(p.noteVolume, p.ambienceVolume)
      if (input.dataset.volume === 'note') playCue('inhale')
    })
  })
}

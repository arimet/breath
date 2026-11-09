import { playCue, setVolumes, unlockAudio } from '../audio/engine'
import { MAX_478_CYCLES, phasesFor, type CustomRhythm, type PresetId } from '../breath/patterns'
import { buildTimeline } from '../breath/timeline'
import { getLang, setLang, t, type Key } from '../i18n'
import { buildMeditation, type MeditationId } from '../meditate/scripts'
import { AMBIENCES, savePrefs, type Ambience, type Prefs } from '../prefs'
import { icons } from './icons'
import type { Sky } from './landscape'
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

function homeSky(): Sky {
  const h = new Date().getHours()
  return h >= 5 && h < 11 ? 'dawn' : h >= 11 && h < 19 ? 'afternoon' : 'night'
}

function save(app: App) {
  savePrefs(app.prefs)
}

/** Swaps the screen with a short cross-fade; the landscape stays put underneath. */
function show(app: App, html: string, bind: (el: HTMLElement) => void) {
  app.root.innerHTML = html
  const el = app.root.firstElementChild as HTMLElement
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
    <button class="round small" data-act="step" data-name="${name}" data-delta="-1" aria-label="${t('less')} · ${label}">${icons.minus}</button>
    <output>${value}</output>
    <button class="round small" data-act="step" data-name="${name}" data-delta="1" aria-label="${t('more')} · ${label}">${icons.plus}</button>
  </div>`

const ambienceChips = (current: Ambience) => `
  <fieldset class="chips">
    <legend>${t('ambience')}</legend>
    ${AMBIENCES.map(
      (a) => `<button class="chip" data-act="ambience" data-value="${a}" aria-pressed="${a === current}">${t(`amb_${a}` as Key)}</button>`,
    ).join('')}
  </fieldset>`

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
  app.land.setSky(homeSky())
  show(
    app,
    `<section class="screen warning">
      <div class="sheet">
        <h2 tabindex="-1">${t('warningTitle')}</h2>
        <ul class="precautions">
          ${(['warning1', 'warning2', 'warning3', 'warning4'] as Key[]).map((k) => `<li>${t(k)}</li>`).join('')}
        </ul>
        <button class="primary wide" data-act="ok">${t('warningOk')}</button>
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
  app.land.setSky(homeSky())
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
    return `<p class="lead">${t('sleepDesc')}</p><p class="tip">${t('sleepTip')}</p>${ambienceChips(p.sleepAmbience)}`
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
  return `<ul class="options">${options}</ul><div class="controls">${controls}</div>${ambienceChips(p.ambience)}`
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
  app.land.setSky(mode === 'breathe' ? 'dawn' : mode === 'meditate' ? 'afternoon' : 'night')
  const title = mode === 'sleep' ? t('sleepTitle') : t(mode === 'breathe' ? 'breathe' : 'meditate')
  const footer = `<footer class="sheet-foot"><button class="primary wide" data-act="start">${t('start')}</button></footer>`
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
        refresh()
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
      start: async () => {
        await unlockAudio()
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
    ${ambienceChips(p.ambience).replace(t('ambience'), t('defaultAmbience'))}
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
      await unlockAudio()
      setVolumes(p.noteVolume, p.ambienceVolume)
      if (input.dataset.volume === 'note') playCue('inhale')
    })
  })
}

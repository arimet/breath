import type { Ambience } from '../prefs'

export type Sky = 'dawn' | 'afternoon' | 'night'

/** Every screen paints the sky of the hour: dawn 5–11 h, afternoon 11–19 h, night otherwise. */
export function skyAt(date = new Date()): Sky {
  const h = date.getHours()
  return h >= 5 && h < 11 ? 'dawn' : h >= 11 && h < 19 ? 'afternoon' : 'night'
}
export interface Land {
  setScene(sky: Sky, ambience: Ambience): void
  dim(level: number): void
}

const W = 390
const H = 844

interface Palette {
  skyTop: string
  skyMid: string
  skyLow: string
  glow: string | null
  cloud: string
  mtn: string
  haze: string
  hillFar: string
  hillMid: string
  hillNear: string
  tree: string
  water: string
  stars: boolean
  grain: number
}

const SKIES: Record<Sky, Palette> = {
  dawn: {
    skyTop: '#9db6d6', skyMid: '#efd2c3', skyLow: '#f7e3c4', glow: '#fff1d2', cloud: '#fff7ef',
    mtn: '#8fa2c2', haze: '#b5c4c9', hillFar: '#9cbc96', hillMid: '#6c9b6f', hillNear: '#4b7a55', tree: '#3c6447',
    water: '#a9cbe0', stars: false, grain: 0.3,
  },
  afternoon: {
    skyTop: '#6c9fd3', skyMid: '#a9cce6', skyLow: '#f1e2b6', glow: '#fff4c4', cloud: '#ffffff',
    mtn: '#7b95bb', haze: '#a9c2c6', hillFar: '#a3c27c', hillMid: '#78a95c', hillNear: '#557f45', tree: '#3b6436',
    water: '#8fbfdd', stars: false, grain: 0.3,
  },
  night: {
    skyTop: '#0a1130', skyMid: '#1a2452', skyLow: '#2e3766', glow: '#e8e4d2', cloud: '#29335c',
    mtn: '#1e2a4e', haze: '#1d2949', hillFar: '#1b2a45', hillMid: '#15223a', hillNear: '#0f192b', tree: '#0c1526',
    water: '#34447a', stars: true, grain: 0.16,
  },
}

const RAIN_DAY: Partial<Palette> = {
  skyTop: '#8a95a5', skyMid: '#a7b0ba', skyLow: '#c3c7c6', glow: null, cloud: '#7d8896',
  mtn: '#8a95a3', haze: '#a1a9b0', hillFar: '#8ea48f', hillMid: '#6d8a70', hillNear: '#4f6a54', tree: '#3c5343',
  water: '#9db1c0',
}
const RAIN_NIGHT: Partial<Palette> = {
  skyTop: '#11172a', skyMid: '#1b2234', skyLow: '#283042', glow: null, cloud: '#252c3c', stars: false,
  mtn: '#20283a', haze: '#252e40', hillFar: '#1b2535', hillMid: '#161f30', hillNear: '#101826', tree: '#0d141f',
}
// A campfire belongs to the end of the day: day skies turn to dusk around it.
const DUSK: Partial<Palette> = {
  skyTop: '#3f4b7c', skyMid: '#b37b8b', skyLow: '#f1a66e', glow: '#ffd39a', cloud: '#e4a596',
  mtn: '#5a5d86', haze: '#87768f', hillFar: '#6b765f', hillMid: '#4e604e', hillNear: '#35473b', tree: '#283a2f',
  water: '#c9a3a8', grain: 0.24,
}

function paletteFor(sky: Sky, ambience: Ambience): Palette {
  const base = SKIES[sky]
  if (ambience === 'rain') return { ...base, ...(sky === 'night' ? RAIN_NIGHT : RAIN_DAY) }
  if (ambience === 'fire' && sky !== 'night') return { ...base, ...DUSK }
  return base
}

/** Ink for the ensō and the words on the sky: dark on light skies, pale at night and dusk. */
export function sceneIsDark(sky: Sky, ambience: Ambience): boolean {
  return sky === 'night' || ambience === 'fire'
}

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A rolling ridge line: a few slow sines with seeded phases. */
function ridge(base: number, amp: number, seed: number) {
  const r = rng(seed)
  const waves = [0.6, 0.28, 0.12].map((w, i) => ({ w, f: (0.006 + r() * 0.006) * (i * 1.9 + 1), p: r() * 6.28 }))
  return (x: number) => base - amp * waves.reduce((y, { w, f, p }) => y + w * Math.sin(x * f + p), 0)
}

const f1 = (n: number) => n.toFixed(1)

/** Smooth closed path through points (Catmull-Rom), closed along the bottom edge. */
function smooth(pts: [number, number][]): string {
  let d = ''
  for (let i = 0; i < pts.length - 1; i++) {
    const [p0, p1, p2, p3] = [pts[i - 1] ?? pts[i], pts[i], pts[i + 1], pts[i + 2] ?? pts[i + 1]]
    d += ` C${f1(p1[0] + (p2[0] - p0[0]) / 6)},${f1(p1[1] + (p2[1] - p0[1]) / 6)} ${f1(p2[0] - (p3[0] - p1[0]) / 6)},${f1(p2[1] - (p3[1] - p1[1]) / 6)} ${f1(p2[0])},${f1(p2[1])}`
  }
  return d
}

function hillPath(y: (x: number) => number): string {
  const pts: [number, number][] = []
  for (let x = -40; x <= W + 40; x += 26) pts.push([x, y(x)])
  return `M${pts[0][0]},${H + 20} L${pts[0][0]},${f1(pts[0][1])}${smooth(pts)} L${pts[pts.length - 1][0]},${H + 20} Z`
}

function stars(): string {
  const r = rng(11)
  let s = ''
  for (let i = 0; i < 80; i++) {
    s += `<circle cx="${f1(r() * W)}" cy="${f1(r() * H * 0.52)}" r="${r() > 0.88 ? 1.4 : f1(0.6 + r() * 0.5)}" opacity="${f1(0.5 + r() * 0.5)}"/>`
  }
  return s
}

function tree(x: number, ground: number): string {
  return `<g fill="currentColor" filter="url(#wc)">
    <path d="M${x - 2.5},${ground + 4} L${x - 1.6},${ground - 26} L${x + 1.6},${ground - 26} L${x + 3},${ground + 4} Z"/>
    <circle cx="${x}" cy="${ground - 40}" r="19"/><circle cx="${x - 14}" cy="${ground - 30}" r="13"/>
    <circle cx="${x + 15}" cy="${ground - 31}" r="14"/><circle cx="${x + 4}" cy="${ground - 54}" r="12"/>
  </g>`
}

function grove(y: (x: number) => number): string {
  const r = rng(41)
  return [38, 52, 61, 176, 188, 258, 270]
    .map((cx) => {
      const rad = 4 + r() * 3
      return `<circle cx="${cx}" cy="${f1(y(cx) - rad * 0.6)}" r="${f1(rad)}"/>`
    })
    .join('')
}

function grass(y: (x: number) => number, n: number): string {
  const r = rng(53)
  let d = ''
  for (let i = 0; i < n; i++) {
    const x = r() * W
    const base = y(x) + 6 + r() * 70
    const h = 6 + r() * 9
    const lean = (r() - 0.5) * 6 + 2
    d += `M${f1(x)},${f1(base)} q${f1(lean / 2)},${f1(-h / 2)} ${f1(lean)},${f1(-h)} `
  }
  return `<path d="${d}" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>`
}

/** A stream that leaves the middle hills and widens towards the viewer. */
function stream(mid: (x: number) => number, p: Palette): string {
  const left: [number, number][] = []
  const right: [number, number][] = []
  const y0 = mid(170) + 4
  for (let i = 0; i <= 12; i++) {
    const t = i / 12
    const y = y0 + (H + 30 - y0) * t
    const cx = 170 + Math.sin(t * 4.6) * (12 + 70 * t) - 30 * t
    const half = 3 + 46 * t + 70 * t * t
    left.push([cx - half, y])
    right.unshift([cx + half, y])
  }
  const edge = (pts: [number, number][]) => `M${f1(pts[0][0])},${f1(pts[0][1])}${smooth(pts)}`
  const body = `${edge(left)} L${f1(right[0][0])},${f1(right[0][1])}${smooth(right).trim()} Z`
  const r = rng(77)
  let glints = ''
  for (let i = 1; i < 12; i++) {
    const [lx, ly] = left[i]
    const [rx] = right[12 - i]
    const w = (rx - lx) * (0.2 + r() * 0.3)
    const x = lx + (rx - lx) * (0.2 + r() * 0.5)
    glints += `M${f1(x)},${f1(ly)} h${f1(w)} `
  }
  return `<g filter="url(#wc)"><path d="${body}" fill="${p.water}"/></g>
    <path d="${glints}" stroke="#ffffff" stroke-opacity="0.55" stroke-width="1.4" stroke-linecap="round" filter="url(#soft)"/>`
}

/** Logs, flames and a warm halo, low on the right. */
export const FIRE = { x: 330, y: 742 }
function campfire(): string {
  const { x, y } = FIRE
  return `<circle cx="${x}" cy="${y - 10}" r="120" fill="url(#fireglow)"/>
    <g filter="url(#wc)">
      <path d="M${x - 26},${y + 8} L${x + 22},${y - 4} L${x + 25},${y + 4} L${x - 23},${y + 16} Z" fill="#3a2a22"/>
      <path d="M${x + 26},${y + 8} L${x - 22},${y - 4} L${x - 25},${y + 4} L${x + 23},${y + 16} Z" fill="#4a3428"/>
      <path d="M${x - 14},${y + 2} C${x - 18},${y - 18} ${x - 4},${y - 26} ${x - 2},${y - 44} C${x + 8},${y - 26} ${x + 18},${y - 16} ${x + 13},${y + 2} Z" fill="#f08a3c"/>
      <path d="M${x - 7},${y + 2} C${x - 9},${y - 12} ${x},${y - 18} ${x + 2},${y - 30} C${x + 8},${y - 16} ${x + 11},${y - 8} ${x + 7},${y + 2} Z" fill="#ffd27a"/>
    </g>`
}

function sceneSvg(sky: Sky, ambience: Ambience): string {
  const p = paletteFor(sky, ambience)
  const mountains = ridge(500, 60, 4)
  const haze = ridge(548, 30, 31)
  const far = ridge(590, 34, 8)
  const mid = ridge(668, 26, 15)
  const near = ridge(760, 16, 23)
  const treeX = ambience === 'fire' ? 64 : 312
  const lowSun = p.glow !== null && ambience === 'fire' && sky !== 'night'
  const sun = p.glow !== null && !lowSun
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" preserveAspectRatio="xMidYMax slice">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${p.skyTop}"/><stop offset="0.55" stop-color="${p.skyMid}"/><stop offset="0.8" stop-color="${p.skyLow}"/>
    </linearGradient>
    <radialGradient id="glow"><stop offset="0" stop-color="${p.glow}"/><stop offset="0.35" stop-color="${p.glow}" stop-opacity="0.9"/><stop offset="1" stop-color="${p.glow}" stop-opacity="0"/></radialGradient>
    <radialGradient id="fireglow"><stop offset="0" stop-color="#ffb35c" stop-opacity="0.55"/><stop offset="1" stop-color="#ff8a3c" stop-opacity="0"/></radialGradient>
    <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1a16" stop-opacity="0"/><stop offset="1" stop-color="#0b1a16" stop-opacity="0.38"/></linearGradient>
    <filter id="wc" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="0.014" numOctaves="3" seed="3" result="warp"/>
      <feDisplacementMap in="SourceGraphic" in2="warp" scale="12" xChannelSelector="R" yChannelSelector="G" result="shape"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="9" result="grain"/>
      <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.7 0 0 0 0.6" result="grainA"/>
      <feComposite in="shape" in2="grainA" operator="in" result="pigment"/>
      <feMorphology in="shape" operator="erode" radius="1.6" result="inner"/>
      <feComposite in="shape" in2="inner" operator="out" result="rim"/>
      <feColorMatrix in="rim" type="matrix" values="0.62 0 0 0 0  0 0.62 0 0 0  0 0 0.62 0 0  0 0 0 0.55 0" result="edge"/>
      <feMerge><feMergeNode in="pigment"/><feMergeNode in="edge"/></feMerge>
    </filter>
    <filter id="soft" x="-30%" y="-60%" width="160%" height="220%">
      <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="5" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="18" xChannelSelector="R" yChannelSelector="G"/>
      <feGaussianBlur stdDeviation="3.5"/>
    </filter>
    <filter id="haze" x="-50%" y="-50%" width="200%" height="200%">
      <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="7" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="5" xChannelSelector="R" yChannelSelector="G"/>
      <feGaussianBlur stdDeviation="1.2"/>
    </filter>
    <filter id="paper" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="2"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0.35  0 0 0 0 0.3  0 0 0 0 0.25  0 0 0 -0.9 0.62"/>
    </filter>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  ${sun ? `<circle cx="318" cy="112" r="92" fill="url(#glow)" opacity="0.75" filter="url(#soft)"/><circle cx="318" cy="112" r="20" fill="${p.glow}" filter="url(#haze)"/>` : ''}
  ${lowSun ? `<circle cx="120" cy="500" r="160" fill="url(#glow)" opacity="0.8" filter="url(#soft)"/>` : ''}
  ${p.stars ? `<g fill="#fffbe8">${stars()}</g>` : ''}
  <path d="${hillPath(mountains)}" fill="${p.mtn}" filter="url(#wc)"/>
  <path d="${hillPath(haze)}" fill="${p.haze}" opacity="0.8" filter="url(#wc)"/>
  <path d="${hillPath(far)}" fill="${p.hillFar}" filter="url(#wc)"/>
  <g fill="${p.tree}" opacity="0.55" filter="url(#wc)">${grove(far)}</g>
  <g color="${p.tree}">${tree(treeX, mid(treeX) + 2)}</g>
  <path d="${hillPath(mid)}" fill="${p.hillMid}" filter="url(#wc)"/>
  <path d="${hillPath(near)}" fill="${p.hillNear}" filter="url(#wc)"/>
  ${ambience === 'stream' ? stream(mid, p) : ''}
  <g color="${p.tree}" opacity="0.45">${grass(near, ambience === 'wind' ? 160 : 90)}</g>
  ${ambience === 'fire' ? campfire() : ''}
  <rect y="${H * 0.55}" width="${W}" height="${H * 0.45}" fill="url(#scrim)"/>
  <rect width="${W}" height="${H}" filter="url(#paper)" opacity="${p.grain}" style="mix-blend-mode:multiply"/>
</svg>`
}

/** Two copies of the same clouds side by side, so a -50% slide loops without a seam. */
function cloudsSvg(sky: Sky, ambience: Ambience): string {
  const p = paletteFor(sky, ambience)
  const r = rng(ambience === 'rain' ? 91 : 19)
  const count = ambience === 'rain' ? 9 : 4
  let one = ''
  for (let i = 0; i < count; i++) {
    const x = (i / count) * W + r() * 40
    const y = ambience === 'rain' ? 30 + r() * 140 : 70 + r() * 300
    const s = ambience === 'rain' ? 1.3 + r() * 0.8 : 0.7 + r() * 0.4
    one += `<g transform="translate(${f1(x)} ${f1(y)}) scale(${f1(s)})"><ellipse rx="46" ry="15"/><ellipse cx="-30" cy="6" rx="30" ry="11"/><ellipse cx="34" cy="5" rx="34" ry="12"/><ellipse cx="8" cy="-10" rx="28" ry="12"/></g>`
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W * 2} 420" width="${W * 2}" height="420">
  <defs><filter id="soft" x="-20%" y="-60%" width="140%" height="220%">
    <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="5" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="18" xChannelSelector="R" yChannelSelector="G"/>
    <feGaussianBlur stdDeviation="3.5"/></filter></defs>
  <g fill="${p.cloud}" opacity="${ambience === 'rain' ? 0.9 : 0.85}" filter="url(#soft)">${one}<g transform="translate(${W} 0)">${one}</g></g>
</svg>`
}

function rainSvg(): string {
  const r = rng(5)
  let d = ''
  for (let i = 0; i < 140; i++) {
    const x = r() * (W + 60) - 30
    const y = r() * H
    const len = 14 + r() * 18
    d += `M${f1(x)},${f1(y)} l${f1(-len * 0.18)},${f1(len)} `
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><path d="${d}" stroke="#eef3f8" stroke-opacity="0.5" stroke-width="1.1" stroke-linecap="round" fill="none"/></svg>`
}

const urls = new Map<string, string>()
function svgUrl(key: string, make: () => string): string {
  let url = urls.get(key)
  if (!url) {
    url = URL.createObjectURL(new Blob([make()], { type: 'image/svg+xml' }))
    urls.set(key, url)
  }
  return url
}

/**
 * The painted scene is rasterised once into an <img>: SVG filters are far too heavy to
 * recompute every frame on a phone. Only cheap composited layers (clouds, rain, fire glow) move.
 */
export function mountLandscape(root: HTMLElement): Land {
  root.innerHTML = `
<div class="stage">
  <img class="scene" alt="" decoding="async"/><img class="scene" alt="" decoding="async"/>
  <div class="clouds"><img alt=""/></div>
  <div class="rain"></div>
  <div class="flicker"></div>
</div>
<div class="land-dim"></div>`
  const scenes = [...root.querySelectorAll<HTMLImageElement>('.scene')]
  const cloudImg = root.querySelector<HTMLImageElement>('.clouds img')!
  const rain = root.querySelector<HTMLElement>('.rain')!
  const dimEl = root.querySelector<HTMLElement>('.land-dim')!
  rain.style.backgroundImage = `url(${svgUrl('rain', rainSvg)})`
  let front = 0
  let currentKey = ''

  return {
    setScene(sky, ambience) {
      const key = `${sky}:${ambience}`
      document.documentElement.dataset.sky = sky
      document.documentElement.dataset.ambience = ambience
      document.documentElement.dataset.ink = sceneIsDark(sky, ambience) ? 'light' : 'dark'
      if (key === currentKey) return
      currentKey = key
      const back = scenes[1 - front]
      back.src = svgUrl(key, () => sceneSvg(sky, ambience))
      cloudImg.src = svgUrl(`clouds:${key}`, () => cloudsSvg(sky, ambience))
      back
        .decode()
        .catch(() => {})
        .then(() => {
          if (currentKey !== key) return
          back.classList.add('on')
          scenes[front].classList.remove('on')
          front = 1 - front
        })
    },
    dim(level) {
      dimEl.style.opacity = String(level)
    },
  }
}

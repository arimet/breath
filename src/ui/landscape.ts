export type Sky = 'dawn' | 'afternoon' | 'night'

const W = 390
const H = 844

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

/** Closed, smoothed path under a ridge (Catmull-Rom through samples). */
function hillPath(y: (x: number) => number): string {
  const pts: [number, number][] = []
  for (let x = -40; x <= W + 40; x += 26) pts.push([x, y(x)])
  let d = `M${pts[0][0]},${H + 20} L${pts[0][0]},${pts[0][1].toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const [p0, p1, p2, p3] = [pts[i - 1] ?? pts[i], pts[i], pts[i + 1], pts[i + 2] ?? pts[i + 1]]
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0]},${p2[1].toFixed(1)}`
  }
  return `${d} L${pts[pts.length - 1][0]},${H + 20} Z`
}

function stars(): string {
  const r = rng(11)
  let s = ''
  for (let i = 0; i < 70; i++) {
    const big = r() > 0.88
    s += `<circle cx="${(r() * W).toFixed(1)}" cy="${(r() * H * 0.52).toFixed(1)}" r="${big ? 1.4 : 0.7 + r() * 0.5}" style="animation-delay:${(-r() * 6).toFixed(2)}s"${big ? ' class="twinkle"' : ''}/>`
  }
  return s
}

function cloud(x: number, y: number, s: number): string {
  const blobs = [
    [0, 0, 46, 15],
    [-30, 6, 30, 11],
    [34, 5, 34, 12],
    [8, -10, 28, 12],
  ]
  return `<g transform="translate(${x} ${y}) scale(${s})">${blobs
    .map(([cx, cy, rx, ry]) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"/>`)
    .join('')}</g>`
}

function tree(x: number, ground: number): string {
  return `<g class="tree" filter="url(#wc)">
    <path d="M${x - 2.5},${ground + 4} L${x - 1.6},${ground - 26} L${x + 1.6},${ground - 26} L${x + 3},${ground + 4} Z"/>
    <circle cx="${x}" cy="${ground - 40}" r="19"/>
    <circle cx="${x - 14}" cy="${ground - 30}" r="13"/>
    <circle cx="${x + 15}" cy="${ground - 31}" r="14"/>
    <circle cx="${x + 4}" cy="${ground - 54}" r="12"/>
  </g>`
}

/** Small round trees scattered along a distant ridge. */
function grove(y: (x: number) => number): string {
  const r = rng(41)
  let g = ''
  for (const cx of [38, 52, 61, 176, 188, 258, 270]) {
    const top = y(cx)
    const rad = 4 + r() * 3
    g += `<circle cx="${cx}" cy="${(top - rad * 0.6).toFixed(1)}" r="${rad.toFixed(1)}"/>`
  }
  return g
}

/** Brush strokes of grass on the nearest hill. */
function grass(y: (x: number) => number): string {
  const r = rng(53)
  let d = ''
  for (let i = 0; i < 90; i++) {
    const x = r() * W
    const base = y(x) + 6 + r() * 70
    const h = 6 + r() * 9
    const lean = (r() - 0.5) * 6
    d += `M${x.toFixed(1)},${base.toFixed(1)} q${(lean / 2).toFixed(1)},${(-h / 2).toFixed(1)} ${lean.toFixed(1)},${(-h).toFixed(1)} `
  }
  return `<path d="${d}"/>`
}

export function mountLandscape(root: HTMLElement): { setSky(s: Sky): void; dim(level: number): void } {
  const mountains = ridge(500, 60, 4)
  const haze = ridge(548, 30, 31)
  const far = ridge(590, 34, 8)
  const mid = ridge(668, 26, 15)
  const near = ridge(760, 16, 23)
  const treeX = 312

  root.innerHTML = `
<svg class="land" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" class="sky-top"/><stop offset="0.55" class="sky-mid"/><stop offset="0.8" class="sky-low"/>
    </linearGradient>
    <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0b1a16" stop-opacity="0"/><stop offset="1" stop-color="#0b1a16" stop-opacity="0.38"/>
    </linearGradient>
    <radialGradient id="glow">
      <stop offset="0" class="glow-core"/><stop offset="0.35" class="glow-core" stop-opacity="0.9"/>
      <stop offset="1" class="glow-core" stop-opacity="0"/>
    </radialGradient>
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
  <circle class="glow" cx="292" cy="250" r="120" fill="url(#glow)" filter="url(#soft)"/>
  <circle class="orb-sun" cx="292" cy="250" r="24" filter="url(#haze)"/>
  <g class="stars">${stars()}</g>
  <g class="clouds"><g class="drift" filter="url(#soft)">${cloud(70, 150, 1)}${cloud(250, 95, 0.75)}${cloud(330, 330, 0.9)}${cloud(-10, 380, 0.7)}</g></g>
  <path class="mtn" d="${hillPath(mountains)}" filter="url(#wc)"/>
  <path class="haze-ridge" d="${hillPath(haze)}" filter="url(#wc)"/>
  <path class="hill-far" d="${hillPath(far)}" filter="url(#wc)"/>
  <g class="grove" filter="url(#wc)">${grove(far)}</g>
  ${tree(treeX, mid(treeX) + 2)}
  <path class="hill-mid" d="${hillPath(mid)}" filter="url(#wc)"/>
  <path class="hill-near" d="${hillPath(near)}" filter="url(#wc)"/>
  <g class="grass">${grass(near)}</g>
  <rect class="land-scrim" y="${H * 0.55}" width="${W}" height="${H * 0.45}" fill="url(#scrim)"/>
  <rect class="paper" width="${W}" height="${H}" filter="url(#paper)"/>
</svg>
<div class="land-dim"></div>`

  const dimEl = root.querySelector<HTMLElement>('.land-dim')!
  return {
    setSky(s) {
      root.dataset.sky = s
      document.documentElement.dataset.sky = s
    },
    dim(level) {
      dimEl.style.opacity = String(level)
    },
  }
}

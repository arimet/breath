/**
 * A brush-drawn ensō, rasterised once as an image. The session reveals it with a
 * conic mask, so drawing it costs a mask update per frame, not an SVG filter pass.
 */
const SIZE = 256
const C = SIZE / 2
const R = 98
/** Where the brush lands, in CSS conic-gradient degrees (0 = top, clockwise). */
export const ENSO_START = -20
/** How far the stroke travels: a little short of a full turn, as an ensō is left open. */
export const ENSO_SWEEP = 338

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
}

function strokeSvg(ink: string): string {
  const N = 220
  const outer: string[] = []
  const inner: string[] = []
  const at = (t: number) => ((ENSO_START + t * ENSO_SWEEP - 90) * Math.PI) / 180
  const radius = (t: number) => R + 4 * Math.sin(t * 4.1 + 0.6) + 1.5 * Math.sin(t * 13) - 5 * smoothstep(0.85, 1, t)
  // Heavy where the brush presses at the start, thinning as the ink runs out.
  const width = (t: number) => 24 * (0.7 + 0.3 * smoothstep(0, 0.04, t)) * (1 - 0.8 * smoothstep(0.3, 0.97, t)) * (1 + 0.1 * Math.sin(t * 19 + 1))
  for (let i = 0; i <= N; i++) {
    const t = i / N
    const a = at(t)
    const r = radius(t)
    const w = width(t) / 2
    outer.push(`${(C + Math.cos(a) * (r + w)).toFixed(2)},${(C + Math.sin(a) * (r + w)).toFixed(2)}`)
    inner.unshift(`${(C + Math.cos(a) * (r - w)).toFixed(2)},${(C + Math.sin(a) * (r - w)).toFixed(2)}`)
  }
  const a0 = at(0)
  const start = `<circle cx="${(C + Math.cos(a0) * radius(0)).toFixed(2)}" cy="${(C + Math.sin(a0) * radius(0)).toFixed(2)}" r="${(width(0) / 2).toFixed(2)}"/>`

  // Dry-brush bristles trailing over the last third of the stroke.
  const rand = rng(29)
  let bristles = ''
  for (let k = 0; k < 11; k++) {
    const off = (rand() - 0.5) * 20
    const t0 = 0.5 + rand() * 0.2
    const t1 = 0.9 + rand() * 0.1
    let d = ''
    for (let i = 0; i <= 40; i++) {
      const t = t0 + ((t1 - t0) * i) / 40
      const a = at(t)
      const r = radius(t) + off * (1 - 0.5 * smoothstep(0.6, 1, t))
      d += `${i ? 'L' : 'M'}${(C + Math.cos(a) * r).toFixed(2)},${(C + Math.sin(a) * r).toFixed(2)}`
    }
    bristles += `<path d="${d}" stroke-width="${(1 + rand() * 2.2).toFixed(2)}" stroke-dasharray="${(20 + rand() * 60).toFixed(0)} ${(3 + rand() * 10).toFixed(0)}"/>`
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE * 2}" height="${SIZE * 2}">
  <defs>
    <filter id="ink" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="3" seed="4" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="7" xChannelSelector="R" yChannelSelector="G" result="rough"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="8" result="g"/>
      <feColorMatrix in="g" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.55 0 0 0 0.62" result="ga"/>
      <feComposite in="rough" in2="ga" operator="in"/>
    </filter>
  </defs>
  <g fill="${ink}" stroke="${ink}" stroke-linecap="round" filter="url(#ink)">
    <path d="M${outer.join(' L')} L${inner.join(' L')} Z" stroke="none"/>
    ${start}
    <g fill="none">${bristles}</g>
  </g>
</svg>`
}

const urls = new Map<string, string>()
export function ensoUrl(ink: string): string {
  let url = urls.get(ink)
  if (!url) {
    url = URL.createObjectURL(new Blob([strokeSvg(ink)], { type: 'image/svg+xml' }))
    urls.set(ink, url)
  }
  return url
}

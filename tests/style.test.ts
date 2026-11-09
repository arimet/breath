import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'

const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8')

/** All [selector, body] pairs whose selector list contains `selector` exactly. */
function rules(selector: string): string[] {
  const found: string[] = []
  const outsideMedia = css.replace(/@media[^{]*\{([^{}]*\{[^{}]*\})*[^{}]*\}/g, '')
  for (const m of outsideMedia.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = m[1].split(',').map((s) => s.trim())
    if (selectors.includes(selector)) found.push(m[2])
  }
  return found
}

test('sleep mode dims its controls until tapped', () => {
  expect(rules('.is-sleep .s-controls').join()).toMatch(/opacity:\s*0\.32/)
  expect(rules('.is-sleep .s-top').join()).toMatch(/opacity:\s*0\.32/)
  expect(rules('.is-sleep.show-controls .s-controls').join()).toMatch(/opacity:\s*1/)
})

test('controls are not dimmed outside sleep mode', () => {
  expect(rules('.s-controls').join()).not.toMatch(/(^|;|\s)opacity:/)
})

test('the ensō is revealed by a conic mask driven by --sweep', () => {
  const body = rules('.enso').join()
  expect(body).toMatch(/mask-image:\s*conic-gradient\(from var\(--from\)/)
  expect(body).toMatch(/var\(--sweep\)/)
})

test('reduced motion stops the moving scenery', () => {
  const block = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'))
  const first = block.slice(0, block.indexOf('}') + 1)
  expect(first).toMatch(/\.clouds/)
  expect(first).toMatch(/\.rain/)
  expect(first).toMatch(/\.flicker/)
  expect(first).toMatch(/animation:\s*none/)
})

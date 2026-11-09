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

test('the night orb colours only apply at night', () => {
  expect(rules('.orb-core')).toHaveLength(1)
  expect(rules(":root[data-sky='night'] .orb-core")).toHaveLength(1)
})

test('reduced motion stops the scenery and the orb shape', () => {
  const block = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'))
  const first = block.slice(0, block.indexOf('}') + 1)
  expect(first).toMatch(/\.drift/)
  expect(first).toMatch(/\.stars \.twinkle/)
  expect(first).toMatch(/\.orb-core/)
  expect(first).toMatch(/animation:\s*none/)
})

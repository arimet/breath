import { expect, test } from 'vitest'
import { createClock } from '../src/session/clock'

function fakeTime() {
  let ms = 0
  return { now: () => ms, advance: (s: number) => (ms += s * 1000) }
}

test('elapsed advances with time', () => {
  const time = fakeTime()
  const clock = createClock(time.now)
  time.advance(2.5)
  expect(clock.elapsed()).toBeCloseTo(2.5)
})

test('pause freezes elapsed and resume continues from there', () => {
  const time = fakeTime()
  const clock = createClock(time.now)
  time.advance(3)
  clock.pause()
  time.advance(10)
  expect(clock.elapsed()).toBeCloseTo(3)
  expect(clock.paused).toBe(true)
  clock.resume()
  time.advance(2)
  expect(clock.elapsed()).toBeCloseTo(5)
  expect(clock.paused).toBe(false)
})

test('repeated pause or resume is harmless', () => {
  const time = fakeTime()
  const clock = createClock(time.now)
  time.advance(1)
  clock.pause()
  time.advance(1)
  clock.pause()
  time.advance(1)
  clock.resume()
  clock.resume()
  time.advance(1)
  expect(clock.elapsed()).toBeCloseTo(2)
})

import { beforeAll, expect, test } from 'vitest'
import { loadAmbience } from '../src/audio/engine'

beforeAll(() => {
  // Minimal AudioContext stand-in: decoding is not what these tests are about.
  class FakeContext {
    state = 'running'
    currentTime = 0
    destination = {}
    createGain() {
      return { gain: { value: 1, setTargetAtTime() {}, cancelScheduledValues() {}, setValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {} }
    }
    decodeAudioData(data: ArrayBuffer) {
      return Promise.resolve({ duration: data.byteLength })
    }
    resume() {
      return Promise.resolve()
    }
  }
  ;(globalThis as any).AudioContext = FakeContext
})

test('loadAmbience resolves null when fetch rejects', async () => {
  const offline = () => Promise.reject(new TypeError('Failed to fetch'))
  await expect(loadAmbience('wind', offline as unknown as typeof fetch)).resolves.toBeNull()
})

test('loadAmbience resolves null when the response is not ok', async () => {
  const notFound = () => Promise.resolve(new Response('nope', { status: 404 }))
  await expect(loadAmbience('rain', notFound as unknown as typeof fetch)).resolves.toBeNull()
})

test('loadAmbience decodes a good response', async () => {
  const ok = () => Promise.resolve(new Response(new Uint8Array(8)))
  await expect(loadAmbience('fire', ok as unknown as typeof fetch)).resolves.toMatchObject({ duration: 8 })
})

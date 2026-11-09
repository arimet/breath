import { afterEach, expect, test } from 'vitest'

let resumeImpl: () => Promise<void>

function installContext() {
  class FakeContext {
    state = 'suspended'
    currentTime = 0
    sampleRate = 44100
    destination = {}
    createGain() {
      return { gain: { value: 1 }, connect() {} }
    }
    createBuffer() {
      return {}
    }
    createBufferSource() {
      return { buffer: null, connect() {}, start() {} }
    }
    resume() {
      return resumeImpl()
    }
  }
  ;(globalThis as any).AudioContext = FakeContext
}

afterEach(() => {
  delete (globalThis as any).AudioContext
})

test('unlockAudioWithin gives up when resume never settles', async () => {
  installContext()
  resumeImpl = () => new Promise(() => {})
  const { unlockAudioWithin } = await import('../src/audio/engine')
  const t0 = Date.now()
  await expect(unlockAudioWithin(50)).resolves.toBeUndefined()
  expect(Date.now() - t0).toBeLessThan(500)
})

test('unlockAudioWithin never rejects', async () => {
  installContext()
  resumeImpl = () => Promise.reject(new Error('interrupted'))
  const { unlockAudioWithin } = await import('../src/audio/engine')
  await expect(unlockAudioWithin(50)).resolves.toBeUndefined()
})

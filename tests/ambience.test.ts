import { beforeAll, expect, test } from 'vitest'
import { startAmbience, stopAll } from '../src/audio/engine'

const started: string[] = []
const pending = new Map<string, (r: Response) => void>()

beforeAll(() => {
  const param = () => ({ value: 1, setTargetAtTime() {}, cancelScheduledValues() {}, setValueAtTime() {}, linearRampToValueAtTime() {} })
  class FakeContext {
    state = 'running'
    currentTime = 0
    destination = {}
    createGain() {
      return { gain: param(), connect() {} }
    }
    createBufferSource() {
      return {
        buffer: null as null | { name: string },
        loop: false,
        connect() {},
        start() {
          started.push(this.buffer!.name)
        },
        stop() {},
      }
    }
    decodeAudioData(data: ArrayBuffer) {
      return Promise.resolve({ name: new TextDecoder().decode(data) })
    }
  }
  ;(globalThis as any).AudioContext = FakeContext
  ;(globalThis as any).fetch = (url: string) => {
    const name = url.match(/sounds\/(\w+)\.m4a/)![1]
    return new Promise<Response>((resolve) => pending.set(name, resolve))
  }
})

const arrive = async (name: string) => {
  pending.get(name)!(new Response(name))
  await new Promise((r) => setTimeout(r, 0))
}

test('an ambience that finishes loading after the session stopped never plays', async () => {
  void startAmbience('wind')
  stopAll()
  await arrive('wind')
  expect(started).toEqual([])
})

test('only the latest requested ambience plays', async () => {
  void startAmbience('rain')
  stopAll()
  void startAmbience('fire')
  await arrive('fire')
  await arrive('rain')
  expect(started).toEqual(['fire'])
})

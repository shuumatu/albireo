import test from 'node:test'
import assert from 'node:assert/strict'
import { createBandwidthMemory, BANDWIDTH_MEMORY_KEY, BANDWIDTH_TTL_MS, cappedPixelRatio, mediaOrigin } from '../src/utils/playbackBandwidth.ts'
import { createQualityPolicy } from '../src/utils/vhsQualityPolicy.ts'

test('startup memory expires, isolates origins/networks, resets and never stores signed paths', () => {
  const data = new Map()
  const storage = { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) }
  let now = 100_000
  const memory = createBandwidthMemory(storage, () => now)
  const origin = mediaOrigin('https://media.example/streams/secret/path?signature=private', 'https://site.example/')
  memory.record(origin, 'wifi:4g:normal', 10_000_000)
  assert.equal(memory.read(origin, 'wifi:4g:normal'), 8_000_000)
  assert.equal(memory.read('https://other.example', 'wifi:4g:normal'), undefined)
  assert.equal(memory.read(origin, 'cellular:4g:normal'), undefined)
  assert.equal(data.get(BANDWIDTH_MEMORY_KEY).includes('secret'), false)
  now += BANDWIDTH_TTL_MS
  assert.equal(memory.read(origin, 'wifi:4g:normal'), undefined)
  memory.record(origin, 'wifi:4g:normal', 90_000_000)
  assert.equal(memory.read(origin, 'wifi:4g:normal'), 20_000_000)
  memory.reset()
  assert.equal(memory.read(origin, 'wifi:4g:normal'), undefined)
  assert.equal(cappedPixelRatio(3.5), 2)
  assert.equal(cappedPixelRatio(1.5), 1.5)
})

test('returning to AUTO batches allowed flags without a fast switch to the last rendition', async () => {
  const fastCalls = [], abrCalls = []
  const high = { id: 'high' }, low = { id: 'low', disabled: true }
  const rep = (playlist, width) => ({ id: playlist.id, width, height: width, playlist, enabled(value) {
    const wasEnabled = !playlist.disabled
    if (value === undefined) return wasEnabled
    playlist.disabled = !value
    if (value && !wasEnabled) fastCalls.push(playlist.id)
    return value
  } })
  const reps = [rep(high, 720), rep(low, 480)]
  const vhs = { representations: () => reps, playlistController_: {
    media: () => high, fastQualityChange_: p => fastCalls.push(p.id), checkABR_: reason => abrCalls.push(reason)
  } }
  const policy = createQualityPolicy()
  policy.apply(vhs, 'source', r => r.width === 720)
  fastCalls.length = 0
  policy.apply(vhs, 'auto', () => true)
  assert.equal(high.disabled, undefined)
  assert.equal(low.disabled, true) // ABR cannot race the pending manual cancellation.
  assert.deepEqual(fastCalls, ['high']) // Cancellation replaces a pending manual call with current/no-op.
  policy.reselect(vhs) // A simultaneous resize/network event must not cancel restoration.
  await new Promise(resolve => setTimeout(resolve, 150))
  assert.equal(low.disabled, undefined)
  assert.deepEqual(abrCalls, ['auto-quality'])
  policy.apply(vhs, 'auto', () => true)
  assert.deepEqual(fastCalls, ['high']) // Metadata repeats do not reapply the selection.
  policy.dispose()
})

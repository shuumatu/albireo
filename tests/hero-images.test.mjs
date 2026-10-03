import test from 'node:test'
import assert from 'node:assert/strict'
import { backgroundSource, normalizeBackgrounds } from '../src/utils/backgroundImages.ts'

const panorama = {
  id: 'panorama', src: '/original.webp',
  width: 8731, height: 2160,
  sources: [960, 1440, 1920].map(height => ({ height, src: `${height}h` }))
}

test('full-height cover chooses by rendered height and bounded device pixels', () => {
  assert.equal(backgroundSource(panorama, 1440, 880, 1), '960h')
  assert.equal(backgroundSource(panorama, 1440, 880, 1.5), '1440h')
  assert.equal(backgroundSource(panorama, 1440, 880, 2), '1920h')
  assert.equal(backgroundSource(panorama, 390, 610, 3), '1440h')
})

test('wide short screens also account for the width needed by cover', () => {
  const narrowerPhoto = { ...panorama, width: 5092 }
  assert.equal(backgroundSource(narrowerPhoto, 2560, 720, 1), '1440h')
  assert.equal(backgroundSource(narrowerPhoto, 3840, 720, 1), '1920h')
  assert.equal(backgroundSource(narrowerPhoto, 5120, 720, 2), '1920h')
})

test('a remote URL alone works, and missing dimensions never pick an undersized rendition', () => {
  const photo = { id: 'remote', src: 'https://cdn.example.com/photo.jpg' }
  assert.equal(backgroundSource(photo, 1440, 880, 2), photo.src)
  assert.equal(backgroundSource({ ...photo, sources: panorama.sources }, 1440, 880, 2), photo.src)
  assert.equal(backgroundSource({ ...panorama, width: 0 }, 1440, 880, 2), panorama.src)
  assert.equal(backgroundSource({ ...panorama, sources: [] }, 1440, 880, 2), panorama.src)
})

test('API rendition order is irrelevant and selection does not mutate the input', () => {
  const sources = [{ height: 1920, src: 'large' }, { height: -1, src: 'bad' },
    { height: 1440, src: 'medium' }, { height: 960, src: 'small' }]
  const photo = { ...panorama, sources }
  assert.equal(backgroundSource(photo, 1440, 880, 1), 'small')
  assert.equal(backgroundSource(photo, 1440, 880, 2, 1.5), 'medium')
  assert.equal(sources[0].height, 1920)
})

test('normalization skips invalid and duplicate identities, preserving the supplied display order', () => {
  const input = [
    { id: 'b', src: ' /b.webp ', sources: [{ height: 960, src: ' /b-small.webp ' }] },
    { id: 'a', src: '/a.webp' }, { id: 'b', src: '/duplicate.webp' },
    { id: '', src: '/missing-id.webp' }, { id: 'empty', src: '  ' }
  ]
  const normalized = normalizeBackgrounds(input)
  assert.deepEqual(normalized.map(({ id }) => id), ['b', 'a'])
  assert.equal(normalized[0].src, '/b.webp')
  assert.equal(normalized[0].sources[0].src, '/b-small.webp')
  assert.equal(input[0].src, ' /b.webp ')
  assert.deepEqual(normalizeBackgrounds([]), [])
})

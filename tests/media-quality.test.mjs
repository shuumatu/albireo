import test from 'node:test'
import assert from 'node:assert/strict'
import { fittedImageWidth, imageForSize, variantFor, defaultLegacy } from '../src/utils/mediaQuality.ts'

test('portrait cover uses both axes and caps DPR to two', () => {
  assert.equal(fittedImageWidth(300, 200, 360, 640, 'cover', 3), 600)
  assert.equal(fittedImageWidth(300, 200, 360, 640, 'contain', 2), 225)
})
test('small maps use thumb while a portrait cover on a high-DPI card uses medium', () => {
  const renditions = [
    { role: 'thumb', url: 'small.webp', mimeType: 'image/webp', width: 360, height: 640 },
    { role: 'medium', url: 'large.webp', mimeType: 'image/webp', width: 900, height: 1600 }
  ]
  assert.equal(imageForSize(renditions, 'legacy', 60, 60, 'cover', 2), 'small.webp')
  assert.equal(imageForSize(renditions, 'legacy', 300, 200, 'cover', 2), 'large.webp')
  assert.equal(imageForSize(undefined, 'legacy', 300, 200), 'legacy')
})
test('menu identity wins over reused rendition ids and unavailable tiers remain unavailable', () => {
  const source = { id: 'original', menuId: 'source', aliases: ['source', '720p'], label: '原画', available: true }
  const hd = { ...source, menuId: '720p', label: '720p' }
  const unavailable = { id: '1080p', menuId: '1080p', label: '1080p', available: false }
  const playback = { masterUrl: 'master', variants: [source, hd, unavailable] }
  assert.equal(variantFor(playback, 'source'), source)
  assert.equal(variantFor(playback, '720p'), hd)
  assert.equal(variantFor(playback, '1080p').available, false)
  assert.equal(defaultLegacy([{ label: '原画' }, { label: '720P' }]), '720p')
})

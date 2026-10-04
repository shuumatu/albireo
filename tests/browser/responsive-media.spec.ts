import { test, expect } from '@playwright/test'
import sharp from 'sharp'

test('portrait cards select AVIF by both dimensions without downloading legacy or WebP too', async ({ page }) => {
  const fetched: string[] = []
  const thumb = await sharp({ create: { width: 360, height: 640, channels: 3, background: '#486070' } }).avif().toBuffer()
  const medium = await sharp({ create: { width: 900, height: 1600, channels: 3, background: '#486070' } }).avif().toBuffer()
  await page.route('**/__quality/**', route => {
    const url = route.request().url(); fetched.push(url)
    return route.fulfill({ contentType: 'image/avif', body: url.includes('medium') ? medium : thumb })
  })
  const renditions = ['avif', 'webp'].flatMap(format => [
    { role: 'thumb', width: 360, height: 640, mimeType: `image/${format}`, url: `/__quality/thumb.${format}` },
    { role: 'medium', width: 900, height: 1600, mimeType: `image/${format}`, url: `/__quality/medium.${format}` }
  ])
  const item = { id: 1, uuid: 'quality-test', itemType: 'image', title: 'Portrait', thumbnailUrl: '/__quality/legacy.jpg', renditions, likeCount: 0, commentCount: 0, createdAt: '2026-10-04' }
  await page.route('**/api/metadata/recommend/featured**', route => route.fulfill({ json: [item] }))
  await page.route('**/api/metadata/recommend/hot**', route => route.fulfill({ json: { items: [], currentTopic: null } }))
  await page.goto('/')
  const img = page.locator('.media-card img').first()
  await img.scrollIntoViewIfNeeded()
  await expect.poll(() => img.evaluate(el => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
  const current = await img.evaluate(el => (el as HTMLImageElement).currentSrc)
  expect(current).toMatch(/\.avif$/)
  expect(fetched.every(url => url.endsWith('.avif'))).toBe(true)
  const bounds = await img.boundingBox()
  expect(bounds!.width).toBeGreaterThan(100)
  expect(bounds!.height).toBeGreaterThan(100)
  if (test.info().project.name === 'mobile') expect(current).toContain('medium')
})

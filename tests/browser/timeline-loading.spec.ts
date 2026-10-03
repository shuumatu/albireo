import { test, expect, type Page } from '@playwright/test'
import sharp from 'sharp'
import { readFile } from 'node:fs/promises'

const photo = await readFile(new URL('../../src/assets/hero/frame-2-1920.webp', import.meta.url))
const landscape = await sharp(photo).resize(900, 600, { fit: 'cover' }).webp().toBuffer()
const portrait = await sharp(photo).resize(450, 600, { fit: 'cover' }).webp().toBuffer()
const preview = await sharp(photo).resize(32, 24, { fit: 'cover' }).webp().toBuffer()
const media = (id: number, overrides = {}) => ({
  uuid: `loading-${id}`, objectKey: `loading-${id}`, createdAt: '2026-10-03T12:00:00',
  mediaType: id === 2 ? 'video' : 'image',
  coverUrl: `/__timeline-test/cover-${id}.webp`, thumbnailUrl: `/__timeline-test/preview-${id}.webp`,
  width: id === 2 ? 450 : 900, height: 600, ...overrides
})
async function setup(page: Page, items: ReturnType<typeof media>[]) {
  await page.route('**/api/metadata/timeline/statistics', route => route.fulfill({ json: {
    earliestDate: '2026-10-03', latestDate: '2026-10-03', totalCount: items.length,
    monthlyDistribution: [{ year: 2026, month: 10, count: items.length }]
  } }))
  await page.route('**/api/metadata/timeline/bucket?**', route => route.fulfill({ json: {
    year: 2026, month: 10, count: items.length, media: items
  } }))
  await page.route('**/__timeline-test/preview-*.webp', route => route.fulfill({ contentType: 'image/webp', body: preview }))
}

test('each photo and video keeps its size through preview, slow loading and reveal', async ({ page }, testInfo) => {
  await setup(page, [media(1), media(2)])
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route('**/__timeline-test/cover-*.webp', async route => {
    await gate
    await route.fulfill({ contentType: 'image/webp', body: route.request().url().includes('cover-2') ? portrait : landscape })
  })
  await page.goto('/timeline')
  const tiles = page.locator('.timeline-media')
  try {
    await expect(tiles.first()).toHaveClass(/has-preview/)
    await expect(tiles.nth(1)).toHaveClass(/has-preview/)
    await expect(tiles.first()).toHaveAttribute('data-state', 'loading')
    await expect(tiles.nth(1).locator('.video-indicator')).toBeVisible()
    const before = await tiles.evaluateAll(els => els.map(el => { const r = el.getBoundingClientRect(); return [r.x, r.y, r.width, r.height] }))
    expect(before[0][2] / before[0][3]).toBeCloseTo(1.5)
    expect(before[1][2] / before[1][3]).toBeCloseTo(.75)
    if (testInfo.project.name === 'reduced-motion') {
      await expect(tiles.first().locator('.media-breath')).toHaveCSS('animation-name', 'none')
      const duration = await tiles.first().locator('.media-image').evaluate(el => parseFloat(getComputedStyle(el).transitionDuration))
      expect(duration).toBeLessThanOrEqual(.001)
    }
    await expect(tiles.first().locator('.media-slow')).toBeVisible({ timeout: 5000 })
    await page.screenshot({ path: testInfo.outputPath('soft-preview.png') })
    release()
    await expect(tiles.first()).toHaveAttribute('data-state', 'ready')
    await expect(tiles.nth(1)).toHaveAttribute('data-state', 'ready')
    await expect(tiles.first().locator('.media-image')).toHaveCSS('opacity', '1')
    await expect(tiles.first().locator('.media-image')).toHaveCSS('filter', 'blur(0px)')
    await expect(page.locator('.media-slow')).toHaveCount(0)
    const after = await tiles.evaluateAll(els => els.map(el => { const r = el.getBoundingClientRect(); return [r.x, r.y, r.width, r.height] }))
    expect(after).toEqual(before)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath('revealed.png') })
    await tiles.nth(1).locator('a').click()
    await expect(page).toHaveURL(/\/video\/loading-2$/)
    await page.goBack()
    await expect(tiles.first()).toHaveAttribute('data-state', 'ready')
  } finally { release() }
})

test('failed cover stops animation and retries without opening its detail', async ({ page }) => {
  await setup(page, [media(1)])
  let requests = 0
  await page.route('**/__timeline-test/cover-1.webp', route => {
    requests++
    return requests === 1 ? route.fulfill({ status: 503, body: 'Unavailable' }) : route.fulfill({ contentType: 'image/webp', body: landscape })
  })
  await page.goto('/timeline')
  const tile = page.locator('.timeline-media')
  await expect(tile).toHaveAttribute('data-state', 'error')
  await expect(tile.locator('.media-breath')).toHaveCSS('animation-name', 'none')
  await page.getByRole('button', { name: '重试加载封面' }).click()
  await expect(page).toHaveURL(/\/timeline$/)
  await expect(tile).toHaveAttribute('data-state', 'ready')
  expect(requests).toBe(2)
})

test('preview errors and old records without dimensions still reveal the cover', async ({ page }) => {
  await setup(page, [media(1, { width: null, height: null })])
  await page.route('**/__timeline-test/preview-1.webp', route => route.abort())
  await page.route('**/__timeline-test/cover-1.webp', route => route.fulfill({ contentType: 'image/webp', body: landscape }))
  await page.goto('/timeline')
  const tile = page.locator('.timeline-media')
  await expect(tile).toHaveAttribute('data-state', 'ready')
  await expect(tile).not.toHaveClass(/has-preview/)
  const box = await tile.boundingBox()
  expect(box!.width / box!.height).toBeCloseTo(1.5)
})

test('same preview URL is not rendered twice and a missing cover does not keep loading', async ({ page }) => {
  await setup(page, [media(1, { thumbnailUrl: '/__timeline-test/cover-1.webp' }), media(2, { coverUrl: null, thumbnailUrl: null })])
  let requests = 0
  await page.route('**/__timeline-test/cover-1.webp', route => { requests++; return route.fulfill({ contentType: 'image/webp', body: landscape }) })
  await page.goto('/timeline')
  await expect(page.locator('.timeline-media').first()).toHaveAttribute('data-state', 'ready')
  await expect(page.locator('.media-preview')).toHaveCount(0)
  await expect(page.locator('.timeline-media').nth(1)).toHaveAttribute('data-state', 'missing')
  await expect(page.getByText('暂无封面')).toBeVisible()
  expect(requests).toBe(1)
})

test('far offscreen media waits until scrolling near it', async ({ page }) => {
  await setup(page, Array.from({ length: 45 }, (_, i) => media(i + 1)))
  const requested = new Set<string>()
  await page.route('**/__timeline-test/cover-*.webp', route => {
    requested.add(route.request().url())
    return route.fulfill({ contentType: 'image/webp', body: landscape })
  })
  await page.goto('/timeline')
  await expect(page.locator('.timeline-media').first()).toHaveAttribute('data-state', 'ready')
  await expect(page.locator('.timeline-media').last()).toHaveAttribute('data-state', 'idle')
  expect([...requested].some(url => url.includes('cover-45.'))).toBe(false)
  await page.locator('.timeline-media').last().scrollIntoViewIfNeeded()
  await expect(page.locator('.timeline-media').last()).toHaveAttribute('data-state', 'ready')
})

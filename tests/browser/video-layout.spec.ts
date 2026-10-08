import { test, expect, type Page } from '@playwright/test'

async function mockVideo(page: Page, width = 1080, height = 1920) {
  const content = {
    objectKey: 'video-layout-test',
    title: 'Video layout test',
    description: '',
    createdAt: '2026-10-05T12:00:00',
    tags: [],
    playback: {
      masterUrl: '/__video-layout/empty.m3u8',
      variants: [{
        id: 'original', menuId: 'source', aliases: ['source'], label: '原画',
        available: true, width, height, url: '/__video-layout/empty.m3u8'
      }]
    }
  }
  await page.route('**/api/metadata/video/info/video-layout-test', route => route.fulfill({ json: content }))
  await page.route('**/api/metadata/share/access/video-layout-test', route => route.fulfill({ json: {
    shareCode: 'video-layout-test', targetType: 'video', title: content.title,
    description: '', needPassword: false, content
  } }))
  // Layout uses the API dimensions; keep media requests local without a codec fixture.
  await page.route('**/__video-layout/**', route => route.fulfill({
    contentType: 'application/vnd.apple.mpegurl',
    body: '#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:1\n#EXT-X-MEDIA-SEQUENCE:0\n#EXT-X-ENDLIST\n'
  }))
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    width: window.innerWidth,
    contentWidth: document.documentElement.scrollWidth
  }))
  expect(dimensions.contentWidth).toBeLessThanOrEqual(dimensions.width + 1)
}

async function expectConstrainedPlayer(page: Page) {
  const player = page.locator('.video-js')
  await expect(player).toBeVisible()
  await expect.poll(() => player.evaluate(el => {
    const bounds = el.getBoundingClientRect()
    return bounds.height > 100 && bounds.height <= window.innerHeight * 0.7 + 1
  })).toBe(true)
  const bounds = await player.boundingBox()
  expect(bounds!.x).toBeGreaterThanOrEqual(-1)
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1)
  await expectNoHorizontalOverflow(page)
}

test('portrait video stays within the viewport height after narrow and short window resizes', async ({ page }) => {
  await mockVideo(page)
  await page.goto('/video/video-layout-test')
  await expectConstrainedPlayer(page)
  for (const viewport of [{ width: 390, height: 550 }, { width: 780, height: 360 }]) {
    await page.setViewportSize(viewport)
    await expectConstrainedPlayer(page)
  }
})

test('landscape video retains its 16:9 frame without horizontal overflow', async ({ page }) => {
  await mockVideo(page, 1920, 1080)
  await page.goto('/video/video-layout-test')
  const player = page.locator('.video-js')
  await expect(player).toBeVisible()
  await expect.poll(() => player.evaluate(el => {
    const bounds = el.getBoundingClientRect()
    return bounds.width / bounds.height
  })).toBeCloseTo(16 / 9, 2)
  await expectNoHorizontalOverflow(page)
})

test('shared portrait video also stays within the viewport height after resizing', async ({ page }) => {
  await mockVideo(page)
  await page.goto('/s/video-layout-test')
  await expectConstrainedPlayer(page)
  await page.setViewportSize({ width: 390, height: 550 })
  await expectConstrainedPlayer(page)
  await page.setViewportSize({ width: 780, height: 360 })
  await expectConstrainedPlayer(page)
})

test('fullscreen portrait video fills the viewport and restores its height limit on exit', async ({ page }) => {
  test.skip(test.info().project.name === 'mobile', 'Desktop Fullscreen API coverage')
  await mockVideo(page)
  await page.goto('/video/video-layout-test')
  await expectConstrainedPlayer(page)
  const player = page.locator('.video-js')
  await player.evaluate(el => { (el as any).player.requestFullscreen() })
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true)
  await expect(player).toHaveClass(/vjs-fullscreen/)
  await expect.poll(() => player.evaluate(el => {
    const bounds = el.getBoundingClientRect()
    return Math.max(Math.abs(bounds.height - window.innerHeight), Math.abs(bounds.width - window.innerWidth))
  })).toBeLessThanOrEqual(1)
  await page.evaluate(() => document.exitFullscreen())
  await expect(player).not.toHaveClass(/vjs-fullscreen/)
  await expectConstrainedPlayer(page)
})

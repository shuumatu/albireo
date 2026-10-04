import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

test('renderer sample plays portrait HLS with shared audio and preserves source alias selection', async ({ page }) => {
  const directory = process.env.HLS_SAMPLE_DIR
  test.skip(!directory, 'Set HLS_SAMPLE_DIR to validate a rendered media package')
  let audioRequests = 0
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/__real-hls/**', route => {
    const path = new URL(route.request().url()).pathname.split('/__real-hls/')[1]!
    if (path.startsWith('a/')) audioRequests++
    return route.fulfill({ contentType: path.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/mp4', body: readFileSync(join(directory!, path)) })
  })
  const original = { id: 'original', menuId: 'source', aliases: ['original', '720p'], label: '原画', width: 720, height: 1280, frameRate: 30.002, codecs: 'avc1.640028,mp4a.40.2', available: true, url: '/__real-hls/original.m3u8' }
  await page.route('**/api/metadata/video/info/real-hls', route => route.fulfill({ json: {
    title: '真实转码样本', createdAt: '2026-10-04', playback: { masterUrl: '/__real-hls/master.m3u8', variants: [original,
      { ...original, menuId: '720p', label: '720p' },
      { id: '1080p', menuId: '1080p', label: '1080p', available: false, reason: '源分辨率不足' },
      { id: '480p', menuId: '480p', label: '480p', width: 480, height: 852, frameRate: 30.002, codecs: 'avc1.64001f,mp4a.40.2', available: true, url: '/__real-hls/480p.m3u8' }
    ] }
  } }))
  await page.goto('/video/real-hls')
  const video = page.locator('video')
  await expect.poll(() => video.evaluate(v => (v as HTMLVideoElement).readyState)).toBeGreaterThanOrEqual(2)
  await video.evaluate(v => (v as HTMLVideoElement).play())
  await expect.poll(() => video.evaluate(v => (v as HTMLVideoElement).currentTime)).toBeGreaterThan(0.5)
  const menu = page.locator('.vjs-quality-menu-button')
  const controls = await page.locator('.vjs-control-bar').boundingBox()
  const quality = await menu.boundingBox()
  const fullscreen = await page.locator('.vjs-fullscreen-control').boundingBox()
  expect(quality!.x + quality!.width).toBeLessThanOrEqual(controls!.x + controls!.width + 1)
  expect(fullscreen!.x + fullscreen!.width).toBeLessThanOrEqual(controls!.x + controls!.width + 1)
  await menu.hover()
  await menu.locator('.vjs-menu-item').nth(1).click()
  await expect.poll(() => page.locator('.video-js').evaluate(el => {
    const reps = (el as any).player.tech(true).vhs.representations()
    return reps.filter((r: any) => r.enabled()).map((r: any) => r.width)
  })).toEqual([720])
  expect(audioRequests).toBeGreaterThan(0)
  expect(errors).toEqual([])
  await page.screenshot({ path: test.info().outputPath('portrait-hls.png') })
})

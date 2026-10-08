import { test, expect } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

test('Video.js seek and volume drags retain the cursor outside their tracks and update playback', async ({ page, isMobile }, testInfo) => {
  test.skip(isMobile, 'Mouse-only cursor integration')
  const ffmpeg = process.env.FFMPEG_PATH || join(homedir(), '.javacpp/cache/ffmpeg-7.1-1.5.11-windows-x86_64-gpl.jar/org/bytedeco/ffmpeg/windows-x86_64-gpl/ffmpeg.exe')
  test.skip(!existsSync(ffmpeg), 'Set FFMPEG_PATH to generate the local HLS fixture')
  const media = testInfo.outputPath('media')
  mkdirSync(media, { recursive: true })
  execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=0x203751:size=320x180:rate=10',
    '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=22050', '-t', '12', '-c:v', 'libx264', '-preset', 'ultrafast', '-g', '20',
    '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-hls_time', '2', '-hls_playlist_type', 'vod', '-hls_segment_type', 'fmp4', 'index.m3u8'], { cwd: media })
  // Production quality filtering uses the resolution advertised by the master.
  writeFileSync(join(media, 'master.m3u8'), '#EXTM3U\n#EXT-X-VERSION:7\n#EXT-X-STREAM-INF:BANDWIDTH=500000,RESOLUTION=320x180\nindex.m3u8\n')
  await page.route('**/__cursor-media/**', route => {
    const name = new URL(route.request().url()).pathname.split('/').pop()!
    return route.fulfill({ contentType: name.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/mp4', body: readFileSync(join(media, name)) })
  })
  await page.route('**/api/metadata/video/info/cursor-seek', route => route.fulfill({ json: {
    title: 'Cursor playback regression', createdAt: '2026-10-08', playback: {
      masterUrl: '/__cursor-media/master.m3u8', variants: [{ id: 'original', menuId: 'source', aliases: ['source'],
        label: '原画', available: true, width: 320, height: 180, frameRate: 10, url: '/__cursor-media/master.m3u8' }]
    }
  } }))
  await page.goto('/video/cursor-seek')
  const video = page.locator('video'), cursor = page.locator('html')
  await expect.poll(() => video.evaluate(v => (v as HTMLVideoElement).readyState)).toBeGreaterThanOrEqual(2)
  await page.locator('.vjs-big-play-button').click()
  await expect.poll(() => video.evaluate(v => (v as HTMLVideoElement).currentTime)).toBeGreaterThan(.1)
  await video.evaluate(v => (v as HTMLVideoElement).pause())
  const seek = page.locator('.vjs-progress-holder')
  await seek.scrollIntoViewIfNeeded()
  const box = (await seek.boundingBox())!
  await page.mouse.move(box.x + box.width * .1, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * .72, box.y + box.height / 2, { steps: 8 })
  await expect(cursor).toHaveAttribute('data-albireo-cursor-state', 'resize')
  await expect.poll(() => video.evaluate(v => (v as HTMLVideoElement).currentTime)).toBeGreaterThan(7)
  // Dragging outside the track keeps the same real cursor and hotspot.
  await page.mouse.move(box.x + box.width * .72, box.y - 80)
  await expect(cursor).toHaveAttribute('data-albireo-cursor-active', '')
  await expect(cursor).toHaveAttribute('data-albireo-cursor-state', 'resize')
  expect(await page.evaluate(({ x, y }) => getComputedStyle(document.elementFromPoint(x, y)!).cursor, {
    x: box.x + box.width * .72, y: box.y - 80
  })).toMatch(/^url\(.+\) 16 16, none$/)
  await page.mouse.up()

  await page.locator('.vjs-volume-panel').hover()
  const volume = page.locator('.vjs-volume-bar')
  await expect(volume).toBeVisible()
  await expect.poll(() => page.locator('.vjs-volume-panel').evaluate(el =>
    el.getAnimations({ subtree: true }).every(animation => animation.playState === 'finished')
  )).toBe(true)
  const volumeBox = (await volume.boundingBox())!
  await page.mouse.move(volumeBox.x + volumeBox.width * .15, volumeBox.y + volumeBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(volumeBox.x + volumeBox.width * .75, volumeBox.y + volumeBox.height / 2, { steps: 5 })
  await expect(cursor).toHaveAttribute('data-albireo-cursor-state', 'resize')
  await expect.poll(() => video.evaluate(v => (v as HTMLVideoElement).volume)).toBeGreaterThan(.6)
  await page.mouse.move(volumeBox.x + volumeBox.width * .2, volumeBox.y + volumeBox.height / 2)
  await expect.poll(() => video.evaluate(v => (v as HTMLVideoElement).volume)).toBeLessThan(.4)
  await page.mouse.up()
  await page.getByRole('link', { name: 'ALBIREO 首页' }).hover()
  await expect(cursor).toHaveAttribute('data-albireo-cursor-state', 'hover')
})

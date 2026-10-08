import { test, expect } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir, homedir } from 'node:os'
import { join, resolve, dirname, basename } from 'node:path'

const ffmpeg = process.env.FFMPEG_PATH || join(homedir(), '.javacpp/cache/ffmpeg-7.1-1.5.11-windows-x86_64-gpl.jar/org/bytedeco/ffmpeg/windows-x86_64-gpl/ffmpeg.exe')
let fixture = ''
test.beforeAll(() => {
  test.skip(!existsSync(ffmpeg), 'Set FFMPEG_PATH to run generated HLS integration fixtures')
  fixture = mkdtempSync(join(tmpdir(), 'albireo-hls-test-'))
  for (const [name, size] of [['original', '1280x720'], ['480p', '854x480']]) {
    mkdirSync(join(fixture, name!))
    execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', `testsrc2=size=${size}:rate=10`, '-t', '16',
      '-an', '-c:v', 'libx264', '-preset', 'ultrafast', '-g', '20', '-sc_threshold', '0', '-pix_fmt', 'yuv420p',
      '-hls_time', '2', '-hls_playlist_type', 'vod', '-hls_segment_type', 'fmp4', '-hls_flags', 'independent_segments', 'index.m3u8'], { cwd: join(fixture, name!) })
  }
  const master = '#EXTM3U\n#EXT-X-VERSION:7\n#EXT-X-INDEPENDENT-SEGMENTS\n#EXT-X-STREAM-INF:BANDWIDTH=2000000,RESOLUTION=1280x720,CODECS="avc1.42c016"\noriginal/index.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=700000,RESOLUTION=854x480,CODECS="avc1.42c016"\n480p/index.m3u8\n'
  writeFileSync(join(fixture, 'master.m3u8'), master)
})
test.afterAll(() => {
  if (fixture && dirname(resolve(fixture)) === resolve(tmpdir()) && basename(fixture).startsWith('albireo-hls-test-'))
    rmSync(fixture, { recursive: true, force: true })
})

test('HLS fixed menu, disabled upscale, shared aliases and rapid paused switching keep the master and position', async ({ page }) => {
  await page.route('**/__hls/**', route => {
    const path = new URL(route.request().url()).pathname.split('/__hls/')[1]!
    return route.fulfill({ contentType: path.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/mp4', body: readFileSync(join(fixture, path)) })
  })
  const original = { id: 'original', menuId: 'source', aliases: ['source', '720p'], label: '原画', available: true, width: 1280, height: 720, frameRate: 10, url: '/__hls/master.m3u8' }
  let authorizations = 0
  await page.route('**/__authorize/hls-test', route => {
    authorizations++; expect(route.request().method()).toBe('POST')
    return route.fulfill({ json: { masterUrl: '/__hls/master.m3u8', variants: [original,
      { ...original, menuId: '720p', label: '720p' },
      { id: '1080p', menuId: '1080p', label: '1080p', width: 1920, height: 1080, available: false, reason: '源分辨率不足' },
      { id: '480p', menuId: '480p', label: '480p', width: 854, height: 480, available: true, url: '/__hls/master.m3u8' }
    ]
  } }) })
  await page.route('**/api/metadata/video/info/hls-test', route => route.fulfill({ json: {
    title: 'HLS test', createdAt: '2026-10-04', playback: { authorizeUrl: '/__authorize/hls-test', masterUrl: '', variants: [] }
  } }))
  await page.goto('/video/hls-test')
  await expect.poll(() => authorizations).toBe(1)
  const video = page.locator('video')
  await expect.poll(() => video.evaluate(v => (v as HTMLVideoElement).readyState)).toBeGreaterThanOrEqual(2)
  await video.evaluate(v => (v as HTMLVideoElement).play())
  await expect.poll(() => video.evaluate(v => (v as HTMLVideoElement).currentTime)).toBeGreaterThan(0.2)
  await video.evaluate(v => { (v as HTMLVideoElement).pause(); (v as HTMLVideoElement).currentTime = 3 })
  await expect.poll(() => video.evaluate(v => (v as HTMLVideoElement).currentTime)).toBeGreaterThanOrEqual(2.9)
  const menu = page.locator('.vjs-quality-menu-button')
  await menu.hover()
  const choices = menu.locator('.vjs-menu-item')
  await expect(choices).toHaveCount(5)
  await expect(choices.nth(2)).toHaveAttribute('aria-disabled', 'true')
  await choices.nth(4).click({ force: true })
  await menu.hover()
  await choices.nth(1).click()
  await menu.hover()
  await choices.nth(3).click()
  await expect(choices.nth(3)).toHaveClass(/vjs-selected/)
  const state = await page.locator('.video-js').evaluate(el => {
    const p = (el as any).player
    return { src: p.currentSrc(), paused: p.paused(), time: p.currentTime(), reps: p.tech(true).vhs.representations().map((r: any) => ({ height: r.height, enabled: r.enabled() })) }
  })
  expect(state.src).toContain('/__hls/master.m3u8')
  expect(state.paused).toBe(true)
  expect(state.time).toBeCloseTo(3, 0)
  expect(state.reps.find((r: any) => r.height === 720)?.enabled).toBe(true)
  expect(state.reps.find((r: any) => r.height === 480)?.enabled).toBe(false)
  await menu.hover()
  await choices.nth(0).click()
  await expect.poll(() => page.locator('.video-js').evaluate(el => (el as any).player.tech(true).vhs.representations().every((r: any) => r.enabled()))).toBe(true)
  await video.evaluate(v => (v as HTMLVideoElement).play())
  await expect.poll(() => video.evaluate(v => (v as HTMLVideoElement).currentTime)).toBeGreaterThan(3.5)
})

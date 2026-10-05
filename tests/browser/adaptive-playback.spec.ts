import { test, expect, type Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir, homedir } from 'node:os'
import { join, resolve, dirname, basename } from 'node:path'

const ffmpeg = process.env.FFMPEG_PATH || join(homedir(), '.javacpp/cache/ffmpeg-7.1-1.5.11-windows-x86_64-gpl.jar/org/bytedeco/ffmpeg/windows-x86_64-gpl/ffmpeg.exe')
let fixture = ''
test.beforeAll(() => {
  test.skip(!existsSync(ffmpeg), 'Set FFMPEG_PATH to generate HLS fixtures')
  fixture = mkdtempSync(join(tmpdir(), 'albireo-abr-test-'))
  for (const [name, size] of [['original', '1280x720'], ['480p', '854x480']]) {
    mkdirSync(join(fixture, name!))
    execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', `testsrc2=size=${size}:rate=10`, '-t', '24',
      '-an', '-c:v', 'libx264', '-preset', 'ultrafast', '-g', '20', '-sc_threshold', '0', '-pix_fmt', 'yuv420p',
      '-hls_time', '2', '-hls_playlist_type', 'vod', '-hls_segment_type', 'fmp4', '-hls_flags', 'independent_segments', 'index.m3u8'], { cwd: join(fixture, name!) })
  }
})
test.afterAll(() => {
  if (fixture && dirname(resolve(fixture)) === resolve(tmpdir()) && basename(fixture).startsWith('albireo-abr-test-')) rmSync(fixture, { recursive: true, force: true })
})

async function setup(page: Page, options: { slow?: boolean; warm?: boolean } = {}) {
  const requests: string[] = []
  await page.addInitScript(({ warm }) => {
    const connection = Object.assign(new EventTarget(), { type: 'wifi', effectiveType: '4g', downlink: 0.2, saveData: false })
    Object.defineProperty(navigator, 'connection', { value: connection, configurable: true })
    sessionStorage.setItem('albireo.mediaDiagnostics', '1')
    if (warm) sessionStorage.setItem('albireo.playbackBandwidth.v1', JSON.stringify([
      { origin: location.origin, network: 'wifi:4g:normal', measuredAt: Date.now(), bandwidth: 25_000_000 }
    ]))
  }, { warm: options.warm })
  const master = '#EXTM3U\n#EXT-X-VERSION:7\n#EXT-X-INDEPENDENT-SEGMENTS\n#EXT-X-STREAM-INF:BANDWIDTH=8000000,RESOLUTION=1280x720,CODECS="avc1.42c016"\noriginal/index.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=1200000,RESOLUTION=854x480,CODECS="avc1.42c016"\n480p/index.m3u8\n'
  await page.route('**/__adaptive/**', async route => {
    const path = new URL(route.request().url()).pathname.split('/__adaptive/')[1]!
    requests.push(path)
    if (path.endsWith('.m4s')) await new Promise(resolve => setTimeout(resolve, options.slow ? 1800 : 40))
    try { await route.fulfill({ contentType: path.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/mp4', body: path === 'master.m3u8' ? master : readFileSync(join(fixture, path)) }) }
    catch { /* A completed test may dispose a request still in flight. */ }
  })
  const original = { id: 'original', menuId: 'source', aliases: ['source', '720p'], label: '原画', available: true, width: 1280, height: 720, frameRate: 10, url: '/__adaptive/master.m3u8' }
  await page.route('**/api/metadata/video/info/adaptive-test', route => route.fulfill({ json: {
    title: 'ABR test', createdAt: '2026-10-05', playback: { masterUrl: '/__adaptive/master.m3u8', variants: [original,
      { ...original, menuId: '720p', label: '720p' },
      { id: '1080p', menuId: '1080p', label: '1080p', available: false },
      { id: '480p', menuId: '480p', label: '480p', width: 854, height: 480, available: true, url: '/__adaptive/master.m3u8' }
    ] }
  } }))
  await page.goto('/video/adaptive-test')
  await page.addStyleTag({ content: '.video-stage { width: 600px !important; max-width: 100%; }' })
  const video = page.locator('video')
  await expect.poll(() => video.evaluate(v => (v as HTMLVideoElement).readyState)).toBeGreaterThanOrEqual(2)
  await video.evaluate(v => (v as HTMLVideoElement).play())
  return requests
}

const state = (page: Page) => page.locator('.video-js').evaluate(el => {
  const p = (el as any).player, vhs = p.tech(true).vhs
  return { height: vhs.playlists.media()?.attributes.RESOLUTION.height, bandwidth: vhs.bandwidth,
    systemBandwidth: vhs.systemBandwidth, ratio: vhs.customPixelRatio,
    networkApi: vhs.options_.useNetworkInformationApi, paused: p.paused(), time: p.currentTime(),
    enabled: vhs.representations().filter((r: any) => r.enabled()).map((r: any) => r.height) }
})

async function selectQuality(page: Page, item: number) {
  const player = page.locator('.video-js'), menu = page.locator('.vjs-quality-menu-button')
  // Touch devices wake controls with a tap; hovering does not report user activity.
  if (await page.evaluate(() => navigator.maxTouchPoints > 0)) {
    // Video.js tap toggles visibility; tapping already visible controls hides them.
    if ((await player.getAttribute('class'))?.includes('vjs-user-inactive')) await player.locator('video').tap()
  } else await player.hover()
  await expect(player).not.toHaveClass(/vjs-user-inactive/)
  const button = menu.locator('button')
  if (await button.getAttribute('aria-expanded') !== 'true') await button.click()
  await menu.locator('.vjs-menu-item').nth(item).click()
}

test.describe('high DPI', () => {
  test.use({ viewport: { width: 820, height: 900 }, deviceScaleFactor: 3 })
  test('fast segments override low downlink, AUTO keeps its ABR choice, and network changes reset startup memory', async ({ page }) => {
    await setup(page)
    await expect.poll(async () => (await state(page)).height).toBe(720)
    await expect.poll(() => page.locator('video').evaluate(v => (v as HTMLVideoElement).videoHeight), { timeout: 10000 }).toBe(720)
    const high = await state(page)
    expect(high.networkApi).toBe(false)
    expect(high.ratio).toBe(2)
    expect(high.bandwidth).toBeGreaterThan(8_000_000)
    await selectQuality(page, 1)
    await expect.poll(async () => (await state(page)).enabled).toEqual([720])
    await page.locator('.video-js').evaluate(el => {
      const controller = (el as any).player.tech(true).vhs.playlistController_
      ;(window as any).__abrChanges = []
      controller.on('renditionselected', (event: any) => (window as any).__abrChanges.push(event.metadata.renditionInfo.resolution.height))
    })
    await selectQuality(page, 0)
    await expect.poll(async () => (await state(page)).enabled.sort()).toEqual([480, 720])
    await page.waitForTimeout(300) // VHS manual debounce is 100ms; observe the complete AUTO transition.
    expect((await state(page)).height).toBe(720)
    expect(await page.evaluate(() => (window as any).__abrChanges)).not.toContain(480)
    await expect.poll(() => page.evaluate(() => !!sessionStorage.getItem('albireo.playbackBandwidth.v1'))).toBe(true)
    const estimateChange = await page.evaluate(() => {
      const handler = (document.querySelector('.video-js') as any).player.tech(true).vhs
      const before = handler.bandwidth
      ;(navigator as any).connection.downlink = 0.1
      ;(navigator as any).connection.dispatchEvent(new Event('change'))
      return { before, after: handler.bandwidth, memory: sessionStorage.getItem('albireo.playbackBandwidth.v1') }
    })
    expect(estimateChange.after).toBe(estimateChange.before)
    expect(estimateChange.memory).toBeNull()
    const reset = await page.evaluate(() => {
      ;(navigator as any).connection.type = 'cellular'
      ;(navigator as any).connection.dispatchEvent(new Event('change'))
      const p = (document.querySelector('.video-js') as any).player
      return { memory: sessionStorage.getItem('albireo.playbackBandwidth.v1'), bandwidth: p.tech(true).vhs.bandwidth }
    })
    expect(reset).toEqual({ memory: null, bandwidth: 4194304 })
    const diagnostics = await page.evaluate(() => (window as any).albireoMediaDiagnostics.snapshot())
    expect(diagnostics.at(-1).sourceToFirstFrameMs).toBeGreaterThanOrEqual(0)
    expect(diagnostics.at(-1).samples.some((s: any) => s.event === 'network-reset')).toBe(true)
    expect(JSON.stringify(diagnostics)).not.toMatch(/https?:|cookie|master\.m3u8|signature/i)
    await page.evaluate(async () => {
      await (document.querySelector('#app') as any).__vue_app__.config.globalProperties.$router.push('/')
    })
    await expect(page.locator('video')).toHaveCount(0)
    const afterUnmount = await page.evaluate(() => {
      const snapshot = () => JSON.stringify((window as any).albireoMediaDiagnostics.snapshot())
      const before = snapshot()
      sessionStorage.setItem('albireo.playbackBandwidth.v1', '[]')
      ;(navigator as any).connection.dispatchEvent(new Event('change'))
      window.dispatchEvent(new Event('resize'))
      return { unchanged: before === snapshot(), memory: sessionStorage.getItem('albireo.playbackBandwidth.v1') }
    })
    expect(afterUnmount).toEqual({ unchanged: true, memory: null })
  })

  test('a warm startup still downgrades when actual segment delivery is slow', async ({ page }) => {
    const requests = await setup(page, { slow: true, warm: true })
    expect(requests.some(path => path.startsWith('original/') && path.endsWith('.m4s'))).toBe(true)
    await expect.poll(async () => (await state(page)).height, { timeout: 15000 }).toBe(480)
    await expect.poll(() => page.locator('video').evaluate(v => (v as HTMLVideoElement).videoHeight), { timeout: 15000 }).toBe(480)
    expect((await state(page)).bandwidth).toBeLessThan(8_000_000)
  })
})

test.describe('one pixel per CSS pixel', () => {
  test.use({ viewport: { width: 820, height: 900 }, deviceScaleFactor: 1 })
  test('small 1x playback retains the fitting rendition while high bandwidth remains available', async ({ page }) => {
    await setup(page, { warm: true })
    await expect.poll(async () => (await state(page)).bandwidth).toBeGreaterThan(8_000_000)
    expect((await state(page)).height).toBe(480)
    expect((await state(page)).ratio).toBe(1)
  })
})

import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

// Opt-in, read-only integration check. Credentials and signed locators must never enter traces.
test.use({ baseURL: process.env.LIVE_FRONTEND_URL || 'http://localhost:5174', trace: 'off', screenshot: 'off' })
test('published HLS plays through the gateway with its scoped cookie', async ({ page }) => {
  const uuid = process.env.LIVE_HLS_UUID
  test.skip(!uuid, 'Set LIVE_HLS_UUID for a migrated video and start local services')
  test.setTimeout(120000)
  const properties = readFileSync(join(homedir(), '.config/shuumatu/service-auth.properties'), 'utf8')
  const tokenProperty = 'service-auth.gateway-token'
  const token = properties.split(/\r?\n/).find(line => line.startsWith(`${tokenProperty}=`))?.split('=').slice(1).join('=')
  expect(Boolean(token)).toBe(true)
  const detail = await page.context().request.get(`http://localhost:8080/video/info/${uuid}`, {
    headers: { 'X-Gateway-Token': token!, 'user-id': '1', 'user-role': 'ADMIN' }
  })
  expect(detail.status()).toBe(200)
  const dto = await detail.json()
  expect(Boolean(dto.playback?.masterUrl)).toBe(true)
  const cookies = await page.context().cookies(dto.playback.masterUrl)
  expect(cookies.some(cookie => cookie.name === 'albireo_playback' && cookie.httpOnly)).toBe(true)
  let mediaResponses = 0
  const failedStatuses: number[] = []
  const network: Array<{ file: string; status?: number; error?: string }> = []
  page.on('requestfailed', request => {
    if (request.url().includes('/streams/')) network.push({ file: new URL(request.url()).pathname.split('/').at(-1)!, error: request.failure()?.errorText })
  })
  page.on('response', response => {
    if (response.url().includes('/streams/')) {
      network.push({ file: new URL(response.url()).pathname.split('/').at(-1)!, status: response.status() })
      if (response.status() >= 400) failedStatuses.push(response.status())
      if (/\.m4s(?:\?|$)/.test(response.url()) && response.ok()) mediaResponses++
    }
  })
  // Expose the administrator-authorized DTO only inside this isolated test browser.
  await page.route(`**/api/metadata/video/info/${uuid}`, route => route.fulfill({ json: dto }))
  await page.goto(`/video/${uuid}`)
  const video = page.locator('video')
  try {
    await expect.poll(() => video.evaluate(v => (v as HTMLVideoElement).readyState), { timeout: 60000 }).toBeGreaterThanOrEqual(2)
  } catch (error) {
    const state = await video.evaluate(v => ({ readyState: (v as HTMLVideoElement).readyState, errorCode: (v as HTMLVideoElement).error?.code }), undefined, { timeout: 2000 }).catch(() => ({ missingVideo: true }))
    console.log(JSON.stringify({ network, state }))
    throw error
  }
  await video.evaluate(v => (v as HTMLVideoElement).play())
  await expect.poll(() => video.evaluate(v => (v as HTMLVideoElement).currentTime), { timeout: 30000 }).toBeGreaterThan(0.5)
  const menu = page.locator('.vjs-quality-menu-button')
  await menu.hover()
  const choices = menu.locator('.vjs-menu-item')
  await expect(choices).toHaveCount(5)
  const beforeSwitch = await video.evaluate(v => (v as HTMLVideoElement).currentTime)
  await choices.nth(4).click()
  const target = dto.playback.variants.find((variant: { menuId: string }) => variant.menuId === '480p')
  await expect.poll(() => page.locator('.video-js').evaluate(el =>
    (el as any).player.tech(true).vhs.representations().filter((r: any) => r.enabled()).map((r: any) => r.width)
  )).toEqual([target.width])
  await expect.poll(() => video.evaluate(v => (v as HTMLVideoElement).currentTime), { timeout: 30000 }).toBeGreaterThan(beforeSwitch + 0.3)
  expect(mediaResponses).toBeGreaterThan(0)
  expect(failedStatuses).toEqual([])
})

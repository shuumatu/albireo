import { test, expect, type Page } from '@playwright/test'

const style = (theme: string) => ({
  version: 8,
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: {
    'background-color': theme === 'light' ? '#f3f2ef' : '#182126'
  } }]
})

async function prepareMap(page: Page) {
  await page.route('**/map-styles/*.json', route => route.fulfill({
    json: style(route.request().url().includes('light') ? 'light' : 'dark')
  }))
  await page.route('**/api/metadata/map/aggregation?**', route => route.fulfill({ json: {
    clusters: [],
    points: [{ uuid: 'theme-photo', mediaType: 'image', longitude: 113.26,
      latitude: 23.13, thumbnailUrl: '/src/assets/hero/frame-1-1920.webp' }],
    totalVideos: 0, totalImages: 1
  } }))
}

test('default basemap follows the saved and changed theme without resetting map zoom or losing media', async ({ page }) => {
  await prepareMap(page)
  await page.addInitScript(() => localStorage.setItem('albireo-theme', 'light'))
  await page.goto('/map')
  await expect(page.getByRole('button', { name: '浅色', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.point-marker-inner')).toHaveCount(1)
  await page.getByRole('button', { name: '放大', exact: true }).click()
  await expect(page.locator('.foot-zoom')).toHaveText('zoom 6')
  const canvas = await page.locator('.maplibregl-canvas').elementHandle()
  await page.getByRole('button', { name: '黑暗模式', exact: true }).click()
  await expect(page.getByRole('button', { name: '深色', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.point-marker-inner')).toHaveCount(1)
  await expect(page.locator('.foot-zoom')).toHaveText('zoom 6')
  expect(await canvas!.evaluate(element => element === document.querySelector('.maplibregl-canvas'))).toBe(true)
})

test('a manually selected satellite basemap survives site theme changes', async ({ page }) => {
  await prepareMap(page)
  await page.route('**/World_Imagery/MapServer/tile/**', route => route.fulfill({
    contentType: 'image/png',
    body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
  }))
  await page.goto('/map')
  await expect(page.locator('.point-marker-inner')).toHaveCount(1)
  const satellite = page.getByRole('button', { name: '卫星图像', exact: true })
  await satellite.click()
  await expect(satellite).toHaveAttribute('aria-pressed', 'true')
  for (const name of ['明亮模式', '黑暗模式']) {
    await page.getByRole('button', { name, exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', name === '明亮模式' ? 'light' : 'dark')
    await expect(satellite).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('.point-marker-inner')).toHaveCount(1)
  }
})

test('a theme changed during initial style loading is applied when the map becomes ready', async ({ page }) => {
  await prepareMap(page)
  let release!: () => void
  let requested = false
  const pending = new Promise<void>(resolve => { release = resolve })
  await page.route('**/map-styles/dark.json', async route => {
    requested = true
    await pending
    await route.fulfill({ json: style('dark') })
  })
  await page.goto('/map')
  try {
    await expect.poll(() => requested).toBe(true)
    await page.getByRole('button', { name: '明亮模式', exact: true }).click()
  } finally {
    release()
  }
  await expect(page.getByRole('button', { name: '浅色', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.point-marker-inner')).toHaveCount(1)
})

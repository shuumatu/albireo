import { test, expect } from '@playwright/test'

test('late pagination from the previous map cluster cannot replace or append to the new cluster', async ({ page }) => {
  await page.route('**/map-styles/*.json', route => route.fulfill({ json: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#182126' } }] } }))
  const clusters = [{ clusterId: 'a', count: 40, imageCount: 40, videoCount: 0, longitude: 110, latitude: 30, representativeMediaType: 'image' },
    { clusterId: 'b', count: 1, imageCount: 1, videoCount: 0, longitude: 111, latitude: 31, representativeMediaType: 'image' }]
  await page.route('**/api/metadata/map/aggregation?**', route => route.fulfill({ json: { clusters, points: [], totalVideos: 0, totalImages: 41 } }))
  let releaseOld!: () => void, requestedOld = false, oldHandled = false
  const pending = new Promise<void>(resolve => { releaseOld = resolve })
  const media = (uuid: string) => ({ uuid, mediaType: 'image', longitude: 110, latitude: 30, thumbnailUrl: '/src/assets/hero/frame-1-1920.webp' })
  await page.route('**/api/metadata/map/cluster/*/media?**', async route => {
    const url = new URL(route.request().url())
    if (url.pathname.includes('/a/')) {
      if (url.searchParams.get('page') === '2') {
        requestedOld = true
        await pending
        try { await route.fulfill({ json: { data: [media('late-old-member')], total: 40 } }) }
        catch { /* Closing the drawer may already have canceled the request. */ }
        oldHandled = true
        return
      }
      return route.fulfill({ json: { data: Array.from({length: 20}, (_, i) => media(`old-${i}`)), total: 40 } })
    }
    return route.fulfill({ json: { data: [media('new-member')], total: 1 } })
  })
  await page.goto('/map')
  await expect(page.locator('.entry-item')).toHaveCount(2)
  if (await page.getByRole('button', { name: '展开侧栏', exact: true }).count()) {
    await page.getByRole('button', { name: '展开侧栏', exact: true }).click()
  }
  await page.locator('.entry-item').first().click()
  await expect(page.locator('.media-item')).toHaveCount(20)
  await page.locator('.n-drawer .n-scrollbar-container').evaluate(el => { el.scrollTop = el.scrollHeight; el.dispatchEvent(new Event('scroll')) })
  await expect.poll(() => requestedOld).toBe(true)
  await page.keyboard.press('Escape')
  await expect(page.locator('.n-drawer')).toHaveCount(0)
  await page.locator('.entry-item').nth(1).click()
  await expect(page.locator('.media-item img[alt="new-member"]')).toHaveCount(1)
  releaseOld()
  await expect.poll(() => oldHandled).toBe(true)
  await expect(page.locator('.media-item')).toHaveCount(1)
  await expect(page.locator('img[alt="late-old-member"]')).toHaveCount(0)
})

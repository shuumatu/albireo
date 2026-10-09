import { test, expect, type Page } from '@playwright/test'

const preview = '/src/assets/hero/frame-1-1920.webp'
const media = (uuid: string, mediaType: 'image' | 'video' = 'image', thumbnailUrl: string | null = preview) => ({
  uuid, mediaType, objectKey: uuid, thumbnailUrl, longitude: 113.26, latitude: 23.13
})

async function prepareMap(page: Page, count: number) {
  await page.route('**/map-styles/*.json', route => route.fulfill({ json: {
    version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#182126' } }]
  } }))
  await page.route('**/api/metadata/map/aggregation?**', route => route.fulfill({ json: {
    clusters: [{ clusterId: 'cluster:with:encoded:bounds', count, imageCount: count - 1, videoCount: 1,
      longitude: 113.26, latitude: 23.13, representativeMediaType: 'image', representativeThumbnailUrl: preview }],
    points: [], totalVideos: 1, totalImages: count - 1
  } }))
}

async function openCluster(page: Page) {
  await page.goto('/map')
  await expect(page.locator('.entry-item')).toHaveCount(1)
  if (await page.getByRole('button', { name: '展开侧栏', exact: true }).count()) {
    await page.getByRole('button', { name: '展开侧栏', exact: true }).click()
  }
  await page.locator('.entry-item').click()
  await expect(page.locator('.cluster-drawer')).toBeVisible()
}

test('cluster previews fill their cells and missing or failed previews remain usable', async ({ page }) => {
  await prepareMap(page, 3)
  let brokenAttempts = 0
  await page.route('**/__cluster/broken.webp', route => {
    brokenAttempts++
    return brokenAttempts === 1 ? route.fulfill({ status: 404 }) : route.fulfill({
      contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="400"><rect width="200" height="400" fill="#486070"/></svg>'
    })
  })
  await page.route('**/api/metadata/map/cluster/*/media?**', route => route.fulfill({ json: {
    data: [media('wide'), media('missing', 'video', null), media('broken', 'image', '/__cluster/broken.webp')], total: 3
  } }))
  await openCluster(page)
  await expect(page.locator('.media-item')).toHaveCount(3)
  const image = page.locator('.media-item img[alt="wide"]')
  await expect.poll(() => image.evaluate(el => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
  const dimensions = await image.evaluate(el => {
    const cell = el.closest('.media-item')!.getBoundingClientRect(), image = el.getBoundingClientRect()
    return { cellWidth: cell.width, cellHeight: cell.height, width: image.width, height: image.height }
  })
  expect(Math.abs(dimensions.width - dimensions.cellWidth)).toBeLessThan(2)
  expect(Math.abs(dimensions.height - dimensions.cellHeight)).toBeLessThan(2)
  await expect(page.locator('.cluster-drawer')).toContainText('暂无预览')
  const broken = page.locator('.media-item').filter({ has: page.locator('img[alt="broken"]') })
  await expect(broken).toContainText('加载失败')
  await broken.getByRole('button', { name: /重试/ }).click()
  await expect.poll(() => broken.locator('img').evaluate(el => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
  await expect(broken).not.toContainText('加载失败')
  expect(brokenAttempts).toBe(2)
  await page.screenshot({ path: test.info().outputPath('cluster-previews.png') })
  await page.locator('.media-item').nth(1).locator('.media-open').press('Enter')
  await expect(page).toHaveURL(/\/video\/missing$/)
  await expect(page.locator('.video-meta h1')).toHaveText('山野片刻')
})

test('first-page and pagination errors can retry the same page without losing or duplicating media', async ({ page }) => {
  await prepareMap(page, 22)
  const calls: number[] = []
  await page.route('**/api/metadata/map/cluster/*/media?**', route => {
    const requestPage = Number(new URL(route.request().url()).searchParams.get('page'))
    calls.push(requestPage)
    const attempt = calls.filter(value => value === requestPage).length
    if (attempt === 1) return route.fulfill({ status: 503, json: { message: 'unavailable' } })
    return route.fulfill({ json: { total: 22, data: requestPage === 1
      ? Array.from({ length: 20 }, (_, i) => media(`member-${i}`))
      : [media('member-19'), media('member-20')] } })
  })
  await openCluster(page)
  await expect(page.locator('.cluster-drawer')).toContainText('媒体暂时无法加载')
  await expect(page.locator('.cluster-drawer')).not.toContainText('没有可显示的媒体')
  await page.locator('.cluster-drawer').getByRole('button', { name: '重试', exact: true }).click()
  await expect(page.locator('.media-item')).toHaveCount(20)
  await page.locator('.cluster-drawer .n-scrollbar-container').evaluate(el => {
    el.scrollTop = el.scrollHeight
    el.dispatchEvent(new Event('scroll'))
  })
  await expect(page.locator('.cluster-drawer')).toContainText('加载更多失败')
  await expect(page.locator('.media-item')).toHaveCount(20)
  await page.locator('.cluster-drawer').getByRole('button', { name: '重试', exact: true }).click()
  await expect(page.locator('.media-item')).toHaveCount(21)
  await expect(page.locator('.media-item img[alt="member-19"]')).toHaveCount(1)
  await expect(page.locator('.cluster-drawer').getByRole('button', { name: '加载更多', exact: true })).toHaveCount(0)
  expect(calls).toEqual([1, 1, 2, 2])
})

test('fullscreen cluster drawers remain visible and selecting an image exits fullscreen', async ({ page }) => {
  test.skip(test.info().project.name === 'mobile', 'Fullscreen API is unavailable on mobile browsers')
  await prepareMap(page, 1)
  await page.route('**/api/metadata/map/cluster/*/media?**', route => route.fulfill({ json: { data: [media('fullscreen-image')], total: 1 } }))
  await page.goto('/map')
  await expect(page.locator('.entry-item')).toHaveCount(1)
  await page.getByRole('button', { name: '全屏', exact: true }).click()
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true)
  await page.locator('.entry-item').click()
  const drawer = page.locator('.map-wrapper .cluster-drawer')
  await expect(drawer).toBeVisible()
  await expect(drawer.locator('.media-item')).toHaveCount(1)
  await drawer.locator('.media-item').click()
  await expect(page).toHaveURL(/\/image\/fullscreen-image$/)
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(false)
  await expect(page.locator('.detail-meta h1')).toHaveText('雪线之上')
  await expect.poll(() => page.locator('.image-open img').evaluate(el => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
})

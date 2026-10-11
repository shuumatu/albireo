import { expect, test, type Page } from '@playwright/test'

test.use({ timezoneId: 'America/Los_Angeles' })

const trip = {
  tripId: 'single-point-trip', year: 2026, month: 9, itemCount: 2,
  startDate: '2026-09-01T00:30:00+08:00', endDate: '2026-09-01T23:30:00+08:00',
  centerLng: 113.26, centerLat: 23.13,
  bboxMinLng: 113.26, bboxMinLat: 23.13, bboxMaxLng: 113.26, bboxMaxLat: 23.13,
  coverUrl: '/src/assets/hero/frame-1-1920.webp', placeName: '同日旅途'
}
const scopeQuery = new URLSearchParams({
  bboxMinLng: '113.26', bboxMinLat: '23.13', bboxMaxLng: '113.26', bboxMaxLat: '23.13',
  start: '2026-09-01', end: '2026-09-01'
})

async function prepareMap(page: Page) {
  const requests: URLSearchParams[] = []
  await page.route('**/map-styles/*.json', route => route.fulfill({ json: {
    version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#182126' } }]
  } }))
  await page.route('**/api/metadata/map/aggregation?**', route => {
    requests.push(new URL(route.request().url()).searchParams)
    return route.fulfill({ json: {
      clusters: [], points: [], totalVideos: 0, totalImages: 0,
      minTime: '2026-09-01T00:30:00+08:00', maxTime: '2026-09-01T23:30:00+08:00'
    } })
  })
  return requests
}

function expectScope(params: URLSearchParams) {
  expect(params.get('minLng')).toBe('113.26')
  expect(params.get('maxLng')).toBe('113.26')
  expect(params.get('minLat')).toBe('23.13')
  expect(params.get('maxLat')).toBe('23.13')
  expect(params.get('startDate')).toBe('2026-09-01')
  expect(params.get('endDate')).toBe('2026-09-01')
}

test('same-day trip cards apply the original point and date from the first request through camera changes', async ({ page }) => {
  const requests = await prepareMap(page)
  await page.route('**/api/metadata/recommend/trips?**', route => route.fulfill({ json: [trip] }))
  await page.goto('/')
  const card = page.locator('.trip-card')
  await expect(card.locator('.trip-date-range')).toHaveText('2026-09-01')
  await card.click()
  await expect(page).toHaveURL(/\/map\?/)
  await expect.poll(() => requests.length).toBeGreaterThan(0)
  const scope = page.getByRole('region', { name: '旅途范围', exact: true })
  await expect(scope).toContainText('2026-09-01')
  await expect(page.locator('.time-axis')).toHaveCount(0)
  requests.forEach(expectScope)

  const beforeZoom = requests.length
  await page.getByRole('button', { name: '放大', exact: true }).click()
  await expect.poll(() => requests.length).toBeGreaterThan(beforeZoom)
  const canvas = page.locator('.maplibregl-canvas')
  const box = (await canvas.boundingBox())!
  const beforePan = requests.length
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.45)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.5, { steps: 12 })
  await page.mouse.up()
  await expect.poll(() => requests.length).toBeGreaterThan(beforePan)
  requests.forEach(expectScope)

  const beforeClear = requests.length
  await scope.getByRole('button', { name: '浏览全部', exact: true }).click()
  await expect(page).toHaveURL(/\/map$/)
  await expect(scope).toHaveCount(0)
  await expect.poll(() => requests.length).toBeGreaterThan(beforeClear)
  expect(requests.at(-1)!.has('startDate')).toBe(false)
  expect(requests.at(-1)!.has('endDate')).toBe(false)
  expect(requests.at(-1)!.get('minLng')).not.toBe(requests.at(-1)!.get('maxLng'))
})

test('query-only navigation replaces the previous scope without remounting the map', async ({ page }) => {
  const requests = await prepareMap(page)
  await page.goto(`/map?${scopeQuery}`)
  await expect.poll(() => requests.length).toBeGreaterThan(0)
  const canvas = await page.locator('.maplibregl-canvas').elementHandle()
  const nextQuery = new URLSearchParams(scopeQuery)
  nextQuery.set('start', '2026-09-02')
  nextQuery.set('end', '2026-09-03')
  nextQuery.set('bboxMaxLng', '113.30')
  await page.evaluate(async path => {
    // Use the application's router to exercise component reuse on query changes.
    // Use the mounted instance: Vite may attach an HMR query to module URLs,
    // and importing a bare URL can create a second, unmounted router.
    const app = (document.getElementById('app') as any).__vue_app__
    await app.config.globalProperties.$router.push(path)
  }, `/map?${nextQuery}`)
  await expect(page.getByRole('region', { name: '旅途范围', exact: true })).toContainText('2026-09-02 — 2026-09-03')
  await expect.poll(() => requests.at(-1)?.get('startDate')).toBe('2026-09-02')
  expect(requests.at(-1)!.get('endDate')).toBe('2026-09-03')
  expect(requests.at(-1)!.get('maxLng')).toBe('113.3')
  expect(await canvas!.evaluate(element => element.isConnected)).toBe(true)
})

test('narrow trip maps keep scope exit accessible with the mobile sidebar open', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Mobile sidebar layout')
  await page.setViewportSize({ width: 320, height: 740 })
  await prepareMap(page)
  await page.goto(`/map?${scopeQuery}`)
  const scope = page.getByRole('region', { name: '旅途范围', exact: true })
  await expect(scope).toBeVisible()
  await page.getByRole('button', { name: '展开侧栏', exact: true }).click()
  await expect(page.locator('.map-sidebar')).toContainText('旅途范围内没有内容')
  await expect(page.locator('.map-sidebar')).not.toContainText('拖动到其它区域')
  const box = (await scope.boundingBox())!
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(320)
  expect(box.y).toBeGreaterThanOrEqual(0)
  await scope.getByRole('button', { name: '浏览全部', exact: true }).click()
  await expect(scope).toHaveCount(0)
  await expect(page).toHaveURL(/\/map$/)
})

test('trip covers fall back from failed renditions and support rendition-only previews', async ({ page }) => {
  await page.route('**/__trip-cover/*', route => {
    if (route.request().url().includes('broken')) return route.fulfill({ status: 404 })
    return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#496a79"/></svg>' })
  })
  await page.route('**/api/metadata/recommend/trips?**', route => route.fulfill({ json: [
    { ...trip, coverUrl: '/__trip-cover/original.webp', renditions: [
      { role: 'thumb', width: 400, height: 300, mimeType: 'image/webp', url: '/__trip-cover/broken.webp' }
    ] },
    { ...trip, tripId: 'rendition-only-trip', coverUrl: null, renditions: [
      { role: 'thumb', width: 400, height: 300, mimeType: 'image/webp', url: '/__trip-cover/rendition.webp' }
    ] }
  ] }))
  await page.goto('/')
  const cards = page.locator('.trip-card')
  await expect(cards).toHaveCount(2)
  await cards.first().scrollIntoViewIfNeeded()
  await expect(cards.first().locator('img')).toHaveAttribute('src', '/__trip-cover/original.webp')
  await expect.poll(() => cards.first().locator('img').evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
  await cards.nth(1).scrollIntoViewIfNeeded()
  await expect(cards.nth(1).locator('img')).toHaveAttribute('src', '/__trip-cover/rendition.webp')
  await expect.poll(() => cards.nth(1).locator('img').evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
})

for (const location of [
  { name: 'Guangzhou', lng: 113.2644, lat: 23.1291 },
  { name: 'Seoul', lng: 126.978, lat: 37.5665 },
  { name: 'Hanoi', lng: 105.8342, lat: 21.0278 }
]) {
  test(`${location.name}: map markers, initial center and viewport queries preserve WGS84`, async ({ page }) => {
    const requests = await prepareMap(page)
    await page.route('**/api/metadata/map/aggregation?**', route => {
      requests.push(new URL(route.request().url()).searchParams)
      return route.fulfill({ json: {
        clusters: [{ clusterId: 'coordinate-cluster', longitude: location.lng + 0.01, latitude: location.lat + 0.01,
          count: 2, videoCount: 0, imageCount: 2, representativeMediaType: 'image',
          representativeObjectKey: '', representativeThumbnailUrl: null }],
        points: [{ uuid: 'coordinate-point', longitude: location.lng, latitude: location.lat,
          mediaType: 'image', objectKey: '', thumbnailUrl: null }],
        totalImages: 3, totalVideos: 0
      } })
    })
    await page.goto(`/map?lng=${location.lng}&lat=${location.lat}`)
    await expect(page.locator('.maplibregl-marker')).toHaveCount(2)
    // Read the mounted component's MapLibre instances rather than calculating
    // expected positions using the application's own coordinate utilities.
    const actual = await page.locator('.map-wrapper').evaluate(element => {
      const state = (element as any).__vueParentComponent.setupState
      const bounds = state.map.getBounds()
      return {
        center: state.map.getCenter().toArray(),
        bounds: [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()],
        markers: state.markerEntries.map((entry: any) => entry.marker.getLngLat().toArray())
      }
    })
    expect(actual.center[0]).toBeCloseTo(location.lng, 9)
    expect(actual.center[1]).toBeCloseTo(location.lat, 9)
    for (const point of [[location.lng, location.lat], [location.lng + 0.01, location.lat + 0.01]]) {
      const marker = actual.markers.find((candidate: number[]) => Math.abs(candidate[1] - point[1]!) < 1e-9)
      expect(marker).toBeDefined()
      expect(marker![0]).toBeCloseTo(point[0]!, 9)
    }
    const request = requests.at(-1)!
    for (const [index, name] of ['minLng', 'minLat', 'maxLng', 'maxLat'].entries()) {
      expect(Number(request.get(name))).toBeCloseTo(actual.bounds[index]!, 9)
    }
  })
}

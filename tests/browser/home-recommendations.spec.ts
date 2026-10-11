import { expect, test } from '@playwright/test'

const photo = (id: number, itemType: 'image' | 'video' = 'image') => ({
  id, uuid: `home-${id}`, itemType, title: `首页作品 ${id}`,
  thumbnailUrl: '/src/assets/hero/frame-1-1920.webp',
  createdAt: '2026-09-12T18:30:00', shotAt: '2026-09-12T18:30:00',
  likeCount: 3, commentCount: 1
})

test('section failures retry independently while other sections remain usable', async ({ page }) => {
  const counts = { featured: 0, hot: 0, trips: 0 }
  await page.route('**/api/metadata/recommend/*', async route => {
    const kind = new URL(route.request().url()).pathname.split('/').pop() as keyof typeof counts
    counts[kind]++
    if (kind === 'featured') {
      if (counts.featured === 1) return route.fulfill({ status: 503, json: {} })
      return route.fulfill({ json: [photo(1)] })
    }
    return route.fallback()
  })
  await page.goto('/')
  const featured = page.locator('#featured')
  await expect(featured.getByRole('alert')).toContainText('暂时无法加载精选')
  await expect(page.locator('#popular .media-card')).toHaveCount(12)
  await expect(page.locator('.trip-card')).toHaveCount(1)
  await featured.getByRole('button', { name: '重试', exact: true }).click()
  await expect(featured.locator('.media-card')).toHaveCount(1)
  expect(counts).toEqual({ featured: 2, hot: 1, trips: 1 })
})

test('refresh keeps cards during loading and failure then accepts the next result', async ({ page }) => {
  let attempts = 0
  let releaseRefresh: (() => void) | undefined
  await page.route('**/api/metadata/recommend/featured?**', async route => {
    attempts++
    if (attempts === 2) {
      await new Promise<void>(resolve => { releaseRefresh = resolve })
      return route.fulfill({ status: 503, json: {} })
    }
    return route.fulfill({ json: [photo(attempts === 1 ? 1 : 2)] })
  })
  await page.goto('/')
  const section = page.locator('#featured')
  const refresh = section.getByRole('button', { name: '刷新精选影像', exact: true })
  await expect(section.locator('.media-card')).toContainText('首页作品 1')
  await refresh.click()
  await expect(refresh).toBeDisabled()
  await expect(section.locator('.media-card')).toContainText('首页作品 1')
  await expect(section.locator('.skeleton-rail')).toHaveCount(0)
  await expect.poll(() => Boolean(releaseRefresh)).toBe(true)
  releaseRefresh!()
  await expect(section.getByText('刷新未成功，仍显示上次加载的内容。')).toBeVisible()
  await expect(section.locator('.media-card')).toContainText('首页作品 1')
  await refresh.click()
  await expect(section.locator('.media-card')).toContainText('首页作品 2')
  await expect(section.getByText('刷新未成功，仍显示上次加载的内容。')).toHaveCount(0)
})

test('media filters only affect their own group and preserve working image and video links', async ({ page }) => {
  await page.goto('/')
  const featured = page.locator('#featured')
  await expect(featured.locator('.media-card')).toHaveCount(12)
  await featured.getByRole('button', { name: '视频 1', exact: true }).click()
  await expect(featured.locator('.media-card')).toHaveCount(1)
  await expect(featured.locator('.media-card')).toHaveAttribute('href', '/video/preview-6')
  await expect(featured.getByRole('button', { name: '视频 1', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(featured.locator('.scroll-controls')).toHaveCount(0)
  await expect(featured).toContainText('本组显示 1 / 12 件')
  await expect(page.locator('#popular .media-card')).toHaveCount(12)
  await featured.getByRole('button', { name: '图片 11', exact: true }).click()
  await expect(featured.locator('.media-card')).toHaveCount(11)
  await expect(featured.locator('.media-card').first()).toHaveAttribute('href', '/image/preview-1')
  await expect(featured.getByRole('button', { name: '向右滚动' })).toBeEnabled()
  await featured.getByRole('button', { name: '全部 12', exact: true }).click()
  await expect(featured.locator('.media-card')).toHaveCount(12)
  const topic = page.getByRole('link', { name: '搜索热门主题 · 光与远方' })
  await topic.click()
  await expect(page).toHaveURL(/\/search\?q=/)
  await expect(page.getByRole('textbox', { name: '描述想寻找的画面' })).toHaveValue('光与远方')
  await expect(page.locator('.result-area .media-card')).toHaveCount(12)
})

test('empty groups offer useful exits and filtering an absent type can recover locally', async ({ page }) => {
  await page.route('**/api/metadata/recommend/featured?**', route => route.fulfill({ json: [photo(1)] }))
  await page.route('**/api/metadata/recommend/trips?**', route => route.fulfill({ json: [] }))
  await page.route('**/api/metadata/recommend/hot?**', route => route.fulfill({ json: { currentTopic: null, items: [] } }))
  await page.goto('/')
  const featured = page.locator('#featured')
  await featured.getByRole('button', { name: '视频 0', exact: true }).click()
  await expect(featured).toContainText('本组暂无视频')
  await featured.getByRole('button', { name: '查看本组全部', exact: true }).click()
  await expect(featured.locator('.media-card')).toHaveCount(1)
  await expect(page.getByRole('link', { name: '去地图探索影像' })).toHaveAttribute('href', '/map')
  await expect(page.locator('#popular').getByRole('link', { name: '去时间线发现影像' })).toHaveAttribute('href', '/timeline')
  await expect(page.locator('#popular .feed-filters')).toHaveCount(0)
})

test('homepage sections remain navigable in both themes and narrow viewports', async ({ page, isMobile }) => {
  if (isMobile) await page.setViewportSize({ width: 320, height: 800 })
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await expect(page.locator('#featured .media-card')).toHaveCount(12)
  for (const theme of ['dark', 'light']) {
    await page.getByRole('button', { name: theme === 'dark' ? '黑暗模式' : '明亮模式', exact: true }).click()
    await page.getByRole('navigation', { name: '首页内容' }).getByRole('link', { name: /01 精选影像/ }).click()
    await expect(page).toHaveURL(/#featured$/)
    const section = page.locator('#featured')
    expect(await section.evaluate(el => el.getBoundingClientRect().top)).toBeGreaterThanOrEqual(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
    const refresh = await section.getByRole('button', { name: '刷新精选影像' }).boundingBox()
    expect(refresh!.width).toBeGreaterThanOrEqual(44)
    expect(refresh!.x + refresh!.width).toBeLessThanOrEqual(await page.evaluate(() => innerWidth))
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
    await page.screenshot({ path: test.info().outputPath(`home-${theme}.png`), fullPage: true, scale: 'css', animations: 'disabled' })
  }
  expect(errors).toEqual([])
})

test('shared cards keep consistent widths inside detail recommendations', async ({ page, isMobile }) => {
  await page.goto('/image/preview-1')
  const related = page.locator('.related .card-wrapper')
  await expect(related).toHaveCount(5)
  await related.first().scrollIntoViewIfNeeded()
  const widths = await related.evaluateAll(elements => elements.map(element => ({
    wrapper: element.getBoundingClientRect().width,
    card: element.querySelector('.media-card')!.getBoundingClientRect().width
  })))
  for (const width of widths) {
    expect(width.wrapper).toBeCloseTo(isMobile ? 240 : 280, 0)
    expect(width.card).toBeCloseTo(width.wrapper, 0)
  }
})

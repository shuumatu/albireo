import { expect, test, type Page } from '@playwright/test'

async function openFixture(page: Page) {
  await page.route('**/__home-cards-test', route => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="app"></div><script type="module" src="/tests/home-cards-fixture.ts"></script></body></html>'
  }))
  await page.route('**/__cards/*', route => {
    if (route.request().url().includes('broken')) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#496a79"/></svg>' })
  })
  await page.goto('/__home-cards-test')
  await expect(page.getByRole('region', { name: '测试作品' })).toBeVisible()
}

test('recommendation arrows track filtering and child widths without container resizing', async ({ page }) => {
  await openFixture(page)
  const section = page.getByRole('region', { name: '测试作品' })
  const rail = section.locator('.scroll-rail')
  const left = section.getByRole('button', { name: '向左滚动' })
  const right = section.getByRole('button', { name: '向右滚动' })
  await expect(left).toBeDisabled()
  await expect(right).toBeEnabled()
  await expect(right).toHaveAttribute('aria-controls', (await rail.getAttribute('id'))!)
  await expect(rail).toHaveAttribute('data-albireo-scroll-motion', 'smooth')
  await right.click()
  await expect(left).toBeEnabled()
  await page.getByRole('button', { name: '单张', exact: true }).click()
  await expect(section.locator('.scroll-controls')).toHaveCount(0)
  await page.getByRole('button', { name: '六张', exact: true }).click()
  await expect(right).toBeEnabled()
  await expect(left).toBeDisabled()
  await page.getByRole('button', { name: '三张', exact: true }).click()
  await expect(section.locator('.scroll-controls')).toHaveCount(0)
  await page.getByRole('button', { name: '加宽卡片', exact: true }).click()
  await expect(right).toBeEnabled()
})

test('recommendation loading, failure, retry and empty entry expose accessible states', async ({ page }) => {
  await openFixture(page)
  const section = page.getByRole('region', { name: '测试作品' })
  await page.getByRole('button', { name: '开始加载', exact: true }).click()
  await expect(section.locator('.section-body')).toHaveAttribute('aria-busy', 'true')
  await expect(section.getByRole('status')).toHaveText('正在加载测试作品…')
  await expect(section.locator('.skeleton-rail')).toHaveAttribute('aria-hidden', 'true')
  await expect(section.locator('.scroll-controls')).toHaveCount(0)
  await page.getByRole('button', { name: '加载失败', exact: true }).click()
  await expect(section.getByRole('alert')).toContainText('网络不可用')
  await expect(section.locator('.section-body')).toHaveAttribute('aria-busy', 'false')
  await section.getByRole('button', { name: '重试', exact: true }).click()
  await expect(section.locator('.fixture-card')).toHaveCount(6)
  await expect(section.getByRole('button', { name: '向右滚动' })).toBeEnabled()
  await page.getByRole('button', { name: '清空', exact: true }).click()
  await expect(section.getByRole('status')).toHaveText('暂无内容')
  await expect(section.getByRole('link', { name: '浏览时间线' })).toHaveAttribute('href', '/timeline')
})

test('media cards recover reused covers, fall back from failed renditions and accept rendition-only images', async ({ page }) => {
  await openFixture(page)
  const card = page.locator('.media-card')
  await card.scrollIntoViewIfNeeded()
  await expect(card.getByText('封面暂不可用')).toBeVisible()
  await expect(card).toHaveAttribute('href', '/image/cover-test')
  await page.route('**/__cards/broken.webp', route => route.fulfill({
    contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"/>'
  }))
  await page.getByRole('button', { name: '刷新同一作品', exact: true }).click()
  await card.scrollIntoViewIfNeeded()
  await expect.poll(() => card.locator('img').evaluate(img => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
  await expect(card.locator('img')).toHaveAttribute('src', '/__cards/broken.webp')
  await page.getByRole('button', { name: '修复封面', exact: true }).click()
  await card.scrollIntoViewIfNeeded()
  await expect.poll(() => card.locator('img').evaluate(img => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
  await expect(card.locator('img')).toHaveAttribute('src', '/__cards/repaired.webp')
  await page.getByRole('button', { name: '失败衍生图', exact: true }).click()
  await card.scrollIntoViewIfNeeded()
  await expect(card.locator('img')).toHaveAttribute('src', '/__cards/fallback.webp')
  await expect.poll(() => card.locator('img').evaluate(img => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
  await page.getByRole('button', { name: '仅衍生图', exact: true }).click()
  await card.scrollIntoViewIfNeeded()
  await expect(card.locator('img')).toHaveAttribute('src', '/__cards/rendition.webp')
  await expect.poll(() => card.locator('img').evaluate(img => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
})

test('touch cards expose interaction counts and fit a narrow rail', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Touch layout')
  await page.setViewportSize({ width: 280, height: 740 })
  await openFixture(page)
  const card = page.locator('.media-card')
  await card.scrollIntoViewIfNeeded()
  await expect(card.locator('.hover-overlay')).toHaveCSS('opacity', '1')
  await expect(card.locator('.meta-pill').first()).toContainText('12 个赞')
  await expect(card.locator('.meta-pill').last()).toContainText('3 条评论')
  const widths = await card.evaluate(element => ({
    card: element.getBoundingClientRect().width,
    rail: element.parentElement!.clientWidth
  }))
  expect(widths.card).toBeLessThanOrEqual(widths.rail)
})

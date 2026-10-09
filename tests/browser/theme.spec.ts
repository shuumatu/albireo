import { test, expect, type Locator, type Page } from '@playwright/test'

type Theme = 'dark' | 'light'
const themeButton = (page: Page, theme: Theme) => page.getByRole('button', {
  name: theme === 'dark' ? '黑暗模式' : '明亮模式', exact: true
})

async function expectTheme(page: Page, theme: Theme) {
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
  await expect(themeButton(page, theme)).toHaveAttribute('aria-pressed', 'true')
  await expect(themeButton(page, theme === 'dark' ? 'light' : 'dark')).toHaveAttribute('aria-pressed', 'false')
}

// Resolve CSS colors in the browser, including color-mix(), without fixing the
// palette to particular hex values. These assertions check usable contrast.
async function luminance(locator: Locator, property = 'color') {
  return locator.evaluate((element, property) => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1
    const context = canvas.getContext('2d')!
    context.fillStyle = getComputedStyle(element).getPropertyValue(property)
    context.fillRect(0, 0, 1, 1)
    const rgb = [...context.getImageData(0, 0, 1, 1).data].slice(0, 3).map(value => {
      const channel = value / 255
      return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4
    })
    return rgb[0]! * .2126 + rgb[1]! * .7152 + rgb[2]! * .0722
  }, property)
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
  for (const theme of ['dark', 'light'] as const) {
    const bounds = await themeButton(page, theme).boundingBox()
    expect(bounds).not.toBeNull()
    expect(bounds!.x).toBeGreaterThanOrEqual(0)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual((await page.evaluate(() => innerWidth)) + 1)
    expect(bounds!.width).toBeGreaterThanOrEqual(24)
    expect(bounds!.height).toBeGreaterThanOrEqual(24)
  }
}

test('theme is keyboard accessible, defaults to dark, and survives navigation and reload', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/')
  await expectTheme(page, 'dark')
  const light = themeButton(page, 'light')
  for (let step = 0; step < 20; step++) {
    await page.keyboard.press('Tab')
    if (await light.evaluate(element => element === document.activeElement)) break
  }
  await expect(light).toBeFocused()
  await page.keyboard.press('Enter')
  await expectTheme(page, 'light')
  expect(await page.evaluate(() => localStorage.getItem('albireo-theme'))).toBe('light')
  await page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '搜索 SEARCH' }).click()
  await expect(page).toHaveURL(/\/search$/)
  await expectTheme(page, 'light')
  await page.reload()
  await expectTheme(page, 'light')
  await themeButton(page, 'dark').focus()
  await page.keyboard.press('Space')
  await expectTheme(page, 'dark')
  await page.reload()
  await expectTheme(page, 'dark')
})

test('saved light palette is painted before Vue loads and invalid values recover to dark', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Bootstrap does not depend on viewport')
  // With the application entry blocked, only the document bootstrap can apply
  // the preference; this catches a flash of dark caused by moving it into Vue.
  await page.route('**/src/main.ts', route => route.abort())
  await page.goto('/')
  await page.evaluate(() => localStorage.setItem('albireo-theme', 'light'))
  await page.reload()
  await expect(page.locator('#app')).toBeEmpty()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  expect(await page.locator('html').evaluate(element => getComputedStyle(element).colorScheme)).toBe('light')
  expect(await luminance(page.locator('html'), 'background-color')).toBeGreaterThan(.8)
  await page.evaluate(() => localStorage.setItem('albireo-theme', 'invalid-old-value'))
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  expect(await luminance(page.locator('html'), 'background-color')).toBeLessThan(.05)
  await page.unroute('**/src/main.ts')
  await page.reload()
  await expectTheme(page, 'dark')
})

test('theme preference synchronizes between open tabs', async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Storage events do not depend on viewport')
  await page.goto('/search')
  const second = await context.newPage()
  await second.goto('/login')
  await expectTheme(second, 'dark')
  await themeButton(page, 'light').click()
  await expectTheme(second, 'light')
  await themeButton(second, 'dark').click()
  await expectTheme(page, 'dark')
  await second.close()
})

test('blocked preference storage still permits changing the current theme', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Storage availability does not depend on viewport')
  await page.addInitScript(() => {
    const getItem = Storage.prototype.getItem
    const setItem = Storage.prototype.setItem
    Storage.prototype.getItem = function (key) {
      if (key === 'albireo-theme') throw new DOMException('Storage unavailable', 'SecurityError')
      return getItem.call(this, key)
    }
    Storage.prototype.setItem = function (key, value) {
      if (key === 'albireo-theme') throw new DOMException('Storage unavailable', 'SecurityError')
      return setItem.call(this, key, value)
    }
  })
  await page.goto('/login')
  await expectTheme(page, 'dark')
  await themeButton(page, 'light').click()
  await expectTheme(page, 'light')
  await expect(page.getByPlaceholder('请输入用户名')).toBeVisible()
})

test('standalone login and share forms switch their component palette without losing input', async ({ page, isMobile }) => {
  if (isMobile) await page.setViewportSize({ width: 320, height: 800 })
  for (const [path, placeholder] of [['/login', '请输入用户名'], ['/s/locked', '请输入访问密码']]) {
    await page.goto(path!)
    const field = page.getByPlaceholder(placeholder!)
    await field.fill('theme-check')
    const input = page.locator('.n-input').first()
    for (const theme of ['dark', 'light'] as const) {
      await themeButton(page, theme).click()
      await expectTheme(page, theme)
      await expect(field).toHaveValue('theme-check')
      if (theme === 'light') {
        await expect.poll(() => luminance(input, 'background-color')).toBeGreaterThan(.75)
      } else {
        await expect.poll(() => luminance(input, 'background-color')).toBeLessThan(.08)
      }
      await expect.poll(async () => {
        const foreground = await luminance(field)
        const background = await luminance(input, 'background-color')
        return (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05)
      }).toBeGreaterThanOrEqual(4.5)
      await expectNoHorizontalOverflow(page)
    }
  }
})

test('both palettes keep photographic captions bright and mobile header controls inside the viewport', async ({ page, isMobile }) => {
  if (isMobile) await page.setViewportSize({ width: 320, height: 800 })
  await page.goto('/')
  const caption = page.locator('.hero-caption h2')
  await expect(caption).toBeVisible()
  const image = page.locator('.background-images img').first()
  await expect.poll(() => image.evaluate(element => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
  for (const theme of ['dark', 'light'] as const) {
    await themeButton(page, theme).click()
    await expectTheme(page, theme)
    await expectNoHorizontalOverflow(page)
    if (isMobile) {
      await page.setViewportSize({ width: 701, height: 800 })
      await expectNoHorizontalOverflow(page)
      await page.setViewportSize({ width: 320, height: 800 })
    }
    expect(await luminance(caption)).toBeGreaterThan(.75)
    expect(await image.evaluate(element => getComputedStyle(element).filter)).toBe('none')
    const card = page.locator('.media-card').first()
    await page.keyboard.press('Tab')
    await card.focus()
    await expect(card.locator('.hover-overlay')).toHaveCSS('opacity', '1')
    expect(await luminance(card.locator('.meta-pill').first())).toBeGreaterThan(.75)
    await page.evaluate(() => window.scrollTo(0, 0))
  }
})

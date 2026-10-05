import { test, expect, type Page } from '@playwright/test'

async function mockGallery(page: Page) {
  await page.route('**/api/metadata/timeline/statistics', route => {
    const admin = route.request().headers().authorization === 'Bearer admin-session'
    return route.fulfill({ json: {
      totalCount: admin ? 1 : 0,
      earliestDate: admin ? '2026-10-03' : null,
      latestDate: admin ? '2026-10-03' : null,
      monthlyDistribution: admin ? [{ year: 2026, month: 10, count: 1 }] : []
    } })
  })
  await page.route('**/api/metadata/timeline/bucket?**', route => route.fulfill({ json: {
    year: 2026, month: 10, count: 1, media: [{
      uuid: 'private-preview', mediaType: 'image', objectKey: 'preview',
      createdAt: '2026-10-03T12:00:00', coverUrl: '/src/assets/hero/frame-1-1920.webp',
      thumbnailUrl: '/src/assets/hero/frame-1-1920.webp', width: 960, height: 600
    }]
  } }))
}

async function submitLogin(page: Page) {
  await page.getByPlaceholder('请输入用户名', { exact: true }).fill('owner')
  await page.getByPlaceholder('请输入密码', { exact: true }).fill('password')
  await page.getByRole('button', { name: '登 录', exact: true }).click()
}

test('normal login accepts administrator and reloads the previously empty timeline', async ({ page }) => {
  await mockGallery(page)
  let loginPath = ''
  await page.route('**/api/auth/login', route => {
    loginPath = new URL(route.request().url()).pathname
    expect(route.request().headers().authorization).toBeUndefined()
    return route.fulfill({ json: { token: 'admin-session', role: 'ADMIN', userId: 1, username: 'owner' } })
  })
  await page.goto('/timeline')
  await expect(page.getByText('暂无公开作品。普通账号仅能查看公开内容。')).toBeVisible()
  await page.getByRole('link', { name: '切换到管理员账号 ↗' }).click()
  await submitLogin(page)
  await expect(page).toHaveURL(/\/timeline$/)
  await expect(page.locator('.preview-label')).toHaveText('管理员预览')
  await expect(page.locator('.timeline-media')).toHaveCount(1)
  expect(loginPath).toMatch(/\/api\/auth\/login$/)

  await page.getByRole('button', { name: 'owner，账户菜单' }).click()
  await page.getByText('退出登录', { exact: true }).click()
  await page.getByRole('link', { name: /返回首页/ }).click()
  await page.getByRole('link', { name: '时间线 TIMELINE' }).click()
  await expect(page.locator('.timeline-media')).toHaveCount(0)
  await expect(page.getByText('暂无公开作品。普通账号仅能查看公开内容。')).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('role'))).toBeNull()
})

test('switching from an ordinary account can use normal login without forwarding its stale token', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'ordinary-session')
    localStorage.setItem('role', 'USER')
    localStorage.setItem('userId', '2')
  })
  await mockGallery(page)
  await page.route('**/api/auth/login', route => {
    expect(route.request().headers().authorization).toBeUndefined()
    return route.fulfill({ json: { token: 'admin-session', role: 'ADMIN', userId: 1, username: 'owner' } })
  })
  await page.goto('/timeline')
  await page.getByRole('link', { name: '切换到管理员账号 ↗' }).click()
  await expect(page).toHaveURL(/\/login\?.*switch=1/)
  await submitLogin(page)
  await expect(page.locator('.timeline-media')).toHaveCount(1)
})

test('structured login errors are shown and do not install a session', async ({ page }) => {
  await page.route('**/api/auth/login', route => route.fulfill({
    status: 403, json: { code: 403, message: '账号暂时无法登录，请联系管理员' }
  }))
  await page.goto('/login')
  await submitLogin(page)
  await expect(page.getByText('账号暂时无法登录，请联系管理员', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull()
})

test('an old unauthorized request cannot clear the newly logged-in account', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'ordinary-session')
    localStorage.setItem('role', 'USER')
    localStorage.setItem('userId', '2')
  })
  await mockGallery(page)
  let release!: () => void
  let waiting = false
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/metadata/recommend/featured?delayed=1', async route => {
    expect(route.request().headers().authorization).toBe('Bearer ordinary-session')
    waiting = true
    await gate
    await route.fulfill({ status: 401, json: { message: '登录已过期' } })
  })
  await page.route('**/api/auth/login', route => route.fulfill({
    json: { token: 'admin-session', role: 'ADMIN', userId: 1, username: 'owner' }
  }))
  await page.goto('/timeline')
  await page.evaluate(() => {
    // This request belongs to the old account and finishes after the account switch.
    void import('/src/utils/request.ts').then(module =>
      module.default.get('/api/metadata/recommend/featured?delayed=1').catch(() => {})
    )
  })
  await expect.poll(() => waiting).toBe(true)
  try {
    await page.getByRole('link', { name: '切换到管理员账号 ↗' }).click()
    await submitLogin(page)
    await expect(page.locator('.timeline-media')).toHaveCount(1)
    const response = page.waitForResponse(r => r.url().endsWith('featured?delayed=1'))
    release()
    await response
    await expect(page.locator('.preview-label')).toBeVisible()
    expect(await page.evaluate(() => localStorage.getItem('token'))).toBe('admin-session')
  } finally { release() }
})

test('another tab signing out clears cached private content in this tab', async ({ page, context }) => {
  await mockGallery(page)
  await page.goto('/login')
  await page.evaluate(() => {
    localStorage.setItem('token', 'admin-session')
    localStorage.setItem('role', 'ADMIN')
    localStorage.setItem('userId', '1')
  })
  await page.reload()
  await page.goto('/timeline')
  await expect(page.locator('.timeline-media')).toHaveCount(1)
  const other = await context.newPage()
  await other.goto('/login?switch=1')
  await other.evaluate(() => localStorage.clear())
  await expect(page.locator('.timeline-media')).toHaveCount(0)
  await expect(page.locator('.preview-label')).toHaveCount(0)
})

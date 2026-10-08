import { test, expect } from '@playwright/test'

test('password submit is deduplicated and 205 private share items remain pageable with one visit', async ({ page }) => {
  let admissions = 0, pages = 0
  const content = (number: number) => ({ collection: { name: '分页验收', createdAt: '2026-10-01' }, collectionType: 'image', total: 205, page: number, pageSize: 50,
    items: Array.from({ length: Math.min(50, 205 - (number - 1) * 50) }, (_, i) => ({ id: (number - 1) * 50 + i + 1, title: `照片 ${(number - 1) * 50 + i + 1}`, imageUrl: '/src/assets/hero/frame-1-1920.webp' })) })
  await page.route('**/api/metadata/share/access/paging**', async route => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/items')) {
      expect(route.request().headers()['x-share-visit']).toBe('accepted-visit')
      pages++
      return route.fulfill({ json: { shareCode: 'paging', targetType: 'collection', visitToken: 'accepted-visit', content: content(Number(url.searchParams.get('page'))) } })
    }
    if (route.request().method() === 'GET') return route.fulfill({ json: { shareCode: 'paging', targetType: 'collection', needPassword: true, content: null } })
    admissions++
    await new Promise(resolve => setTimeout(resolve, 300))
    return route.fulfill({ json: { shareCode: 'paging', targetType: 'collection', needPassword: false, visitToken: 'accepted-visit', content: content(1) } })
  })
  await page.goto('/s/paging')
  const password = page.getByPlaceholder('请输入访问密码')
  await password.fill('test-password'); await password.press('Enter'); await password.press('Enter')
  await expect(page.locator('.item-card')).toHaveCount(50)
  expect(admissions).toBe(1)
  for (const count of [100,150,200,205]) {
    await page.getByRole('button', { name: /加载更多/ }).click()
    await expect(page.locator('.item-card')).toHaveCount(count)
  }
  expect(pages).toBe(4); expect(admissions).toBe(1)
  await expect(page.getByRole('button', { name: /加载更多/ })).toHaveCount(0)
})

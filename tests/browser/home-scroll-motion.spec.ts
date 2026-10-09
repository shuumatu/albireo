import { test, expect, type Page } from '@playwright/test'

async function homeRail(page: Page) {
  await page.goto('/')
  const rail = page.locator('#selected .recommend-section').first().locator('.scroll-rail:not(.skeleton-rail)')
  await expect(rail.locator('.media-card')).toHaveCount(12)
  await rail.scrollIntoViewIfNeeded()
  await expect(rail).toHaveAttribute('data-albireo-scroll-motion', 'smooth')
  const id = await rail.getAttribute('id')
  const bar = page.locator(`[role="scrollbar"][aria-controls="${id}"][aria-orientation="horizontal"]`)
  return { rail, bar }
}

async function pauseFrames(page: Page) {
  const start = new Date('2026-10-09T00:00:00Z')
  await page.clock.install({ time: start })
  await page.clock.pauseAt(new Date(start.getTime() + 1000))
}

test('home scrollbar follows continuously and eases to the requested position after release', async ({ page, isMobile }, testInfo) => {
  test.skip(isMobile || testInfo.project.name === 'reduced-motion', 'Animated mouse drag')
  const { rail, bar } = await homeRail(page)
  await expect(bar).toBeVisible()
  expect(await rail.evaluate(e => getComputedStyle(e).scrollSnapType)).toBe('none')
  const box = (await bar.boundingBox())!, thumb = (await bar.locator('.albireo-scrollbar-thumb').boundingBox())!
  const max = await rail.evaluate(e => e.scrollWidth - e.clientWidth)
  const distance = (box.width - thumb.width) * .36
  const target = max * .36
  await pauseFrames(page)
  await page.mouse.move(thumb.x + thumb.width / 2, thumb.y + thumb.height / 2)
  await page.mouse.down()
  await page.mouse.move(thumb.x + thumb.width / 2 + distance, thumb.y + thumb.height / 2)
  // The old instant + snap implementation jumps to a card in this same event.
  expect(await rail.evaluate(e => e.scrollLeft)).toBe(0)
  await page.clock.runFor(32)
  const first = await rail.evaluate(e => e.scrollLeft)
  expect(first).toBeGreaterThan(0)
  expect(first).toBeLessThan(target * .75)
  await page.mouse.up()
  await page.clock.runFor(32)
  const second = await rail.evaluate(e => e.scrollLeft)
  expect(second).toBeGreaterThan(first)
  expect(second).toBeLessThan(target)
  await page.clock.runFor(800)
  expect(await rail.evaluate(e => e.scrollLeft)).toBeCloseTo(target, 0)
  expect(Number(await bar.getAttribute('aria-valuenow'))).toBeCloseTo(target, 0)
})

test('track clicks retain their target while dragging and keyboard commands reach both ends', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Mouse and keyboard scrollbar')
  const { rail, bar } = await homeRail(page)
  await expect(bar).toBeVisible()
  const box = (await bar.boundingBox())!, thumb = (await bar.locator('.albireo-scrollbar-thumb').boundingBox())!
  const max = await rail.evaluate(e => e.scrollWidth - e.clientWidth)
  const x = box.x + box.width * .7, y = box.y + box.height / 2
  const distance = 25
  const target = Math.min(max, (x - box.x - thumb.width / 2 + distance) / (box.width - thumb.width) * max)
  await pauseFrames(page)
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + distance, y)
  await page.mouse.up()
  await page.clock.runFor(800)
  expect(await rail.evaluate(e => e.scrollLeft)).toBeCloseTo(target, 0)
  await bar.evaluate(e => (e as HTMLElement).focus())
  await page.keyboard.press('Home')
  await page.clock.runFor(800)
  expect(await rail.evaluate(e => e.scrollLeft)).toBe(0)
  await page.keyboard.press('End')
  await page.clock.runFor(800)
  expect(await rail.evaluate(e => e.scrollLeft)).toBe(max)
  await page.keyboard.press('Home')
  await page.clock.runFor(800)
  // Two rapid keys add to the desired position, including before a frame runs.
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  await page.clock.runFor(800)
  expect(await rail.evaluate(e => e.scrollLeft)).toBe(80)
})

test('reduced motion applies the drag immediately without snapping to a card', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'reduced-motion', 'Reduced motion preference')
  const { rail, bar } = await homeRail(page)
  await expect(bar).toBeVisible()
  const box = (await bar.boundingBox())!, thumb = (await bar.locator('.albireo-scrollbar-thumb').boundingBox())!
  const max = await rail.evaluate(e => e.scrollWidth - e.clientWidth)
  const distance = (box.width - thumb.width) * .37
  await pauseFrames(page)
  await page.mouse.move(thumb.x + thumb.width / 2, thumb.y + thumb.height / 2)
  await page.mouse.down()
  await page.mouse.move(thumb.x + thumb.width / 2 + distance, thumb.y + thumb.height / 2)
  expect(await rail.evaluate(e => e.scrollLeft)).toBeCloseTo(max * .37, 0)
  await page.mouse.up()
  await page.clock.runFor(300)
  expect(await rail.evaluate(e => e.scrollLeft)).toBeCloseTo(max * .37, 0)
})

test('native wheel input interrupts an unfinished drag animation', async ({ page, isMobile }, testInfo) => {
  test.skip(isMobile || testInfo.project.name === 'reduced-motion', 'Animated mouse drag')
  const { rail, bar } = await homeRail(page)
  await expect(bar).toBeVisible()
  const box = (await bar.boundingBox())!, thumb = (await bar.locator('.albireo-scrollbar-thumb').boundingBox())!
  await pauseFrames(page)
  await page.mouse.move(thumb.x + thumb.width / 2, thumb.y + thumb.height / 2)
  await page.mouse.down()
  await page.mouse.move(thumb.x + thumb.width / 2 + (box.width - thumb.width) * .5, thumb.y + thumb.height / 2)
  await page.mouse.up()
  await page.clock.runFor(32)
  const before = await rail.evaluate(e => e.scrollLeft)
  await rail.dispatchEvent('wheel', { deltaX: -120 })
  await page.clock.runFor(800)
  expect(await rail.evaluate(e => e.scrollLeft)).toBe(before)
})

test('touch keeps a native scrollable rail and the shared recommendation default keeps snapping', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Native touch rail')
  const { rail } = await homeRail(page)
  await expect(page.locator('.albireo-scrollbars')).toHaveCount(0)
  expect(await rail.evaluate(e => getComputedStyle(e).overflowX)).toBe('auto')
  expect(await rail.evaluate(e => getComputedStyle(e).scrollSnapType)).toBe('none')
  await rail.evaluate(e => e.scrollTo({ left: 135, behavior: 'instant' }))
  expect(await rail.evaluate(e => e.scrollLeft)).toBe(135)
  await page.goto('/image/preview-1')
  const related = page.locator('.image-detail .related .scroll-rail:not(.skeleton-rail)')
  // SimilarStrip shares RecommendSection but did not opt into the homepage drag.
  await expect(related.locator('.card-wrapper')).toHaveCount(5)
  expect(await related.getAttribute('data-albireo-scroll-motion')).toBeNull()
  // Chrome may omit the default proximity value when serializing this style.
  expect(await related.evaluate(e => getComputedStyle(e).scrollSnapType)).toMatch(/^x(?: proximity)?$/)
})

import { test, expect, type Page } from '@playwright/test'

// Long days exercise scrolling; consecutive short days must remain individually
// selectable even when their headings occupy the same photo row.
const months = [
  { year: 2026, month: 12, days: [[28, 40], [24, 16], [12, 1], [8, 1], [4, 1]] },
  { year: 2026, month: 6, days: [[28, 18], [12, 1], [8, 1], [4, 1]] },
  { year: 2025, month: 12, days: [[28, 12], [12, 1], [8, 1], [4, 1]] }
]
const monthKey = (year: number, month: number) => `${year}-${month}`
const dateKeys = months.flatMap(month => month.days.map(([day]) => `${monthKey(month.year, month.month)}-${day}`))

declare global {
  interface Window {
    timelineScrollSamples?: number[]
    timelineScrollSampling?: number
  }
}

async function setup(page: Page, delayOlderMonths = false) {
  const requested = new Set<string>()
  const completed = new Set<string>()
  const releases = new Map<string, () => void>()
  const gates = new Map(months.slice(1).map(month => {
    const key = monthKey(month.year, month.month)
    return [key, new Promise<void>(resolve => { releases.set(key, resolve) })] as const
  }))
  await page.route('**/api/metadata/timeline/statistics', route => route.fulfill({ json: {
    earliestDate: '2025-12-04', latestDate: '2026-12-28',
    totalCount: months.reduce((total, month) => total + month.days.reduce((count, [, size]) => count + size!, 0), 0),
    monthlyDistribution: months.map(month => ({
      year: month.year, month: month.month,
      count: month.days.reduce((count, [, size]) => count + size!, 0)
    }))
  } }))
  await page.route('**/api/metadata/timeline/bucket?**', async route => {
    const url = new URL(route.request().url())
    const year = Number(url.searchParams.get('year'))
    const month = Number(url.searchParams.get('month'))
    const key = monthKey(year, month)
    const entry = months.find(item => item.year === year && item.month === month)
    requested.add(key)
    if (delayOlderMonths) await gates.get(key)
    const media = (entry?.days ?? []).flatMap(([day, size]) => Array.from({ length: size! }, (_, index) => ({
      uuid: `scrubber-${key}-${day}-${index}`, objectKey: `scrubber-${key}-${day}-${index}`,
      createdAt: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T12:00:00`,
      mediaType: 'image', coverUrl: null, thumbnailUrl: null,
      width: size === 1 ? 180 : 900, height: 600
    })))
    await route.fulfill({ json: { year, month, count: media.length, media } })
    completed.add(key)
  })
  await page.goto('/timeline')
  await expect(page.locator('.time-segment[data-key="2026-12-28"]')).toHaveAttribute('data-loaded', 'true')
  await expect(page.getByRole('slider', { name: '按时间浏览' })).toHaveAttribute('aria-disabled', 'false')
  return {
    requested, completed,
    release: (key?: string) => key ? releases.get(key)?.() : releases.forEach(resolve => resolve())
  }
}

async function loadAllMonths(page: Page) {
  for (const month of months) {
    await page.getByRole('combobox', { name: '跳转到月份' }).selectOption(monthKey(month.year, month.month))
    await expect(page.locator(`.time-segment[data-key="${monthKey(month.year, month.month)}-28"]`))
      .toHaveAttribute('data-loaded', 'true')
  }
  await expect(page.locator('.time-segment[data-loaded="true"]')).toHaveCount(dateKeys.length)
  await page.getByRole('slider', { name: '按时间浏览' }).press('Home')
  await expectSelectedDate(page, dateKeys[0]!)
}

async function trackPoint(page: Page, ratio: number) {
  const box = await page.locator('.scrubber-track').boundingBox()
  expect(box).not.toBeNull()
  return { x: box!.x + box!.width / 2, y: box!.y + box!.height * ratio }
}

async function datePoint(page: Page, key: string) {
  const segment = page.locator(`.time-segment[data-key="${key}"]`)
  const start = Number(await segment.getAttribute('data-start'))
  const end = Number(await segment.getAttribute('data-end'))
  return trackPoint(page, (start + end) / 2)
}

async function datePosition(page: Page, key: string) {
  return page.evaluate(dateKey => {
    const scroller = document.querySelector<HTMLElement>('.main-content')!
    const group = scroller.querySelector<HTMLElement>(`[data-group="${dateKey}"]`)!
    const track = document.querySelector<HTMLElement>('.scrubber-track')!.getBoundingClientRect()
    const indicator = document.querySelector<HTMLElement>('.scroll-indicator')!.getBoundingClientRect()
    const segment = document.querySelector<HTMLElement>(`.time-segment[data-key="${dateKey}"]`)!
    return {
      scrollTop: scroller.scrollTop,
      target: Math.max(0, group.offsetTop - 20),
      headingTop: group.getBoundingClientRect().top - scroller.getBoundingClientRect().top,
      maxScroll: scroller.scrollHeight - scroller.clientHeight,
      indicatorError: Math.abs(indicator.top + indicator.height / 2 - track.top - Number(segment.dataset.position) * track.height)
    }
  }, key)
}

async function expectSelectedDate(page: Page, key: string) {
  await expect(page.locator('.scroll-indicator')).toHaveAttribute('data-key', key)
  await expect(page.locator(`[data-group="${key}"]`).first()).toHaveClass(/is-time-selected/)
  await expect(page.getByRole('combobox', { name: '跳转到月份' })).toHaveValue(key.split('-').slice(0, 2).join('-'))
  await expect.poll(async () => {
    const state = await datePosition(page, key)
    return Math.abs(state.scrollTop - state.target)
  }).toBeLessThan(1.5)
  await expect.poll(async () => (await datePosition(page, key)).indicatorError).toBeLessThan(1)
}

async function selectDate(page: Page, key: string) {
  const point = await datePoint(page, key)
  await page.mouse.click(point.x, point.y)
  await expectSelectedDate(page, key)
}

async function startScrollSamples(page: Page) {
  await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>('.main-content')!
    window.timelineScrollSamples = [root.scrollTop]
    const sample = () => {
      window.timelineScrollSamples!.push(root.scrollTop)
      window.timelineScrollSampling = requestAnimationFrame(sample)
    }
    window.timelineScrollSampling = requestAnimationFrame(sample)
  })
}

async function stopScrollSamples(page: Page) {
  return page.evaluate(() => {
    cancelAnimationFrame(window.timelineScrollSampling!)
    window.timelineScrollSampling = undefined
    return window.timelineScrollSamples!
  })
}

test('dragging selects exact dates, animates content, and preserves selection outside the rail and after release', async ({ page }, testInfo) => {
  await setup(page)
  await loadAllMonths(page)
  const slider = page.getByRole('slider', { name: '按时间浏览' })
  const start = await datePoint(page, dateKeys[0]!)
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  try {
    await expect(slider).toHaveClass(/is-dragging/)
    await expectSelectedDate(page, dateKeys[0]!)
    const animatedKey = '2026-12-24'
    const before = (await datePosition(page, animatedKey)).scrollTop
    await startScrollSamples(page)
    const point = await datePoint(page, animatedKey)
    await page.mouse.move(point.x, point.y)
    await expect(page.locator('.scroll-indicator')).toHaveAttribute('data-key', animatedKey)
    await expectSelectedDate(page, animatedKey)
    const target = (await datePosition(page, animatedKey)).target
    const samples = await stopScrollSamples(page)
    const intermediate = samples.filter(value => value > before + 2 && value < target - 2)
    expect(target - before).toBeGreaterThan(300)
    if (testInfo.project.name === 'reduced-motion') expect(intermediate).toEqual([])
    else expect(intermediate.length).toBeGreaterThan(0)

    const outsideKey = '2026-6-12'
    const outside = await datePoint(page, outsideKey)
    await page.mouse.move(outside.x - 160, outside.y)
    await expect(slider).toHaveClass(/is-dragging/)
    await expectSelectedDate(page, outsideKey)
    await expect(page.locator('.hover-label')).toHaveAttribute('data-key', outsideKey)
  } finally { await page.mouse.up() }
  await expect(slider).not.toHaveClass(/is-dragging/)
  await expectSelectedDate(page, '2026-6-12')
  const hover = await datePoint(page, '2025-12-4')
  await page.mouse.move(hover.x, hover.y)
  await expect(page.locator('.hover-label')).toHaveAttribute('data-key', '2025-12-4')
  await expectSelectedDate(page, '2026-6-12')
  // A newer choice must replace an animation that is still travelling.
  const firstChoice = await datePoint(page, '2025-12-4')
  const secondChoice = await datePoint(page, '2026-12-12')
  await page.mouse.click(firstChoice.x, firstChoice.y)
  await page.mouse.click(secondChoice.x, secondChoice.y)
  await expectSelectedDate(page, '2026-12-12')
})

test('every bottom date reaches the reading position and dates sharing a row have separate hit regions', async ({ page }) => {
  await setup(page)
  await loadAllMonths(page)
  for (const key of dateKeys.filter(key => key.startsWith('2025-12-'))) {
    await selectDate(page, key)
    const state = await datePosition(page, key)
    expect(state.headingTop).toBeCloseTo(20, 0)
    expect(state.maxScroll + 1).toBeGreaterThanOrEqual(state.target)
  }
  const sharedKeys = await page.evaluate(() => {
    const firsts = new Map<string, number>()
    document.querySelectorAll<HTMLElement>('[data-group^="2025-12-"]').forEach(group => {
      if (!firsts.has(group.dataset.group!)) firsts.set(group.dataset.group!, group.offsetTop)
    })
    const entries = [...firsts.entries()]
    for (let index = 1; index < entries.length; index++) {
      if (entries[index]![1] === entries[index - 1]![1]) return [entries[index - 1]![0], entries[index]![0]]
    }
    return []
  })
  expect(sharedKeys).toHaveLength(2)
  await selectDate(page, sharedKeys[0]!)
  const firstPosition = await page.locator(`.time-segment[data-key="${sharedKeys[0]}"]`).getAttribute('data-position')
  await selectDate(page, sharedKeys[1]!)
  const secondPosition = await page.locator(`.time-segment[data-key="${sharedKeys[1]}"]`).getAttribute('data-position')
  expect(secondPosition).not.toBe(firstPosition)
  await expect(page.locator(`[data-group="${sharedKeys[0]}"]`).first()).not.toHaveClass(/is-time-selected/)
  const bottom = await trackPoint(page, 1)
  await page.mouse.click(bottom.x, bottom.y)
  await expectSelectedDate(page, dateKeys[dateKeys.length - 1]!)
})

test('keyboard visits adjacent dates and manual content scrolling exits date selection', async ({ page }) => {
  await setup(page)
  await loadAllMonths(page)
  const slider = page.getByRole('slider', { name: '按时间浏览' })
  for (const [key, expected] of [
    ['Home', dateKeys[0]!], ['ArrowDown', dateKeys[1]!], ['ArrowRight', dateKeys[2]!],
    ['ArrowUp', dateKeys[1]!], ['End', dateKeys[dateKeys.length - 1]!]
  ]) {
    await slider.press(key!)
    await expectSelectedDate(page, expected!)
    await expect(slider).toHaveAttribute('aria-valuenow', String(dateKeys.indexOf(expected!)))
  }
  const rail = await trackPoint(page, 1)
  await page.mouse.move(rail.x, rail.y)
  await page.mouse.wheel(0, -40)
  await expectSelectedDate(page, dateKeys[dateKeys.length - 2]!)
  const scroller = page.locator('.main-content')
  const box = await scroller.boundingBox()
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
  await page.mouse.wheel(0, -550)
  await expect(scroller).not.toHaveClass(/is-date-seeking/)
  await expect(page.locator('.is-time-selected')).toHaveCount(0)
  await expect.poll(async () => page.evaluate(() => {
    const root = document.querySelector<HTMLElement>('.main-content')!
    let current = ''
    let largestTop = -1
    document.querySelectorAll<HTMLElement>('.time-segment').forEach(segment => {
      const group = root.querySelector<HTMLElement>(`[data-group="${segment.dataset.key}"]`)!
      const top = Math.max(0, group.offsetTop - 20)
      if (top <= root.scrollTop + 1 && top > largestTop) { current = segment.dataset.key!; largestTop = top }
    })
    return document.querySelector<HTMLElement>('.scroll-indicator')!.dataset.key === current
  })).toBe(true)
  await selectDate(page, '2026-12-24')
  await scroller.dispatchEvent('keydown', { key: 'PageUp', bubbles: true })
  await expect(page.locator('.is-time-selected')).toHaveCount(0)
  await selectDate(page, '2026-6-28')
  await scroller.dispatchEvent('touchstart', { bubbles: true })
  await expect(page.locator('.is-time-selected')).toHaveCount(0)
})

test('a selected month expands to an accurate date and an older dropdown request cannot replace newer selection', async ({ page }) => {
  const fixture = await setup(page, true)
  try {
    const pendingKey = '2025-12-15'
    const point = await datePoint(page, pendingKey)
    await page.mouse.click(point.x, point.y)
    await expect(page.locator('.scroll-indicator')).toHaveAttribute('data-key', pendingKey)
    await expect.poll(() => fixture.requested.has('2025-12')).toBe(true)
    expect(fixture.completed.has('2025-12')).toBe(false)
    fixture.release('2025-12')
    await expect(page.locator('.time-segment[data-key="2025-12-28"]')).toHaveAttribute('data-loaded', 'true')
    await expect(page.locator('.scroll-indicator')).toHaveAttribute('data-key', /^2025-12-(28|12|8|4)$/)
    const expandedKey = await page.locator('.scroll-indicator').getAttribute('data-key')
    await expectSelectedDate(page, expandedKey!)

    await page.getByRole('combobox', { name: '跳转到月份' }).selectOption('2026-6')
    await expect.poll(() => fixture.requested.has('2026-6')).toBe(true)
    expect(fixture.completed.has('2026-6')).toBe(false)
    await selectDate(page, '2026-12-24')
    fixture.release('2026-6')
    await expect.poll(() => fixture.completed.has('2026-6')).toBe(true)
    await expect(page.locator('.time-segment[data-key="2026-6-28"]')).toHaveAttribute('data-loaded', 'true')
    await expectSelectedDate(page, '2026-12-24')
  } finally { fixture.release() }
})

test('touch dragging selects dates and remains usable after cancellation', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Touch cancellation is exercised in the mobile project')
  await setup(page)
  await loadAllMonths(page)
  const slider = page.getByRole('slider', { name: '按时间浏览' })
  const session = await page.context().newCDPSession(page)
  let touching = false
  const touch = async (type: 'touchStart' | 'touchMove', key: string) => {
    const point = await datePoint(page, key)
    await session.send('Input.dispatchTouchEvent', {
      type, touchPoints: [{ x: point.x, y: point.y, id: 1, radiusX: 1, radiusY: 1 }]
    })
    touching = true
  }
  try {
    await touch('touchStart', '2026-12-24')
    await expect(slider).toHaveClass(/is-dragging/)
    await expectSelectedDate(page, '2026-12-24')
    await touch('touchMove', '2026-6-12')
    await expectSelectedDate(page, '2026-6-12')
    await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] })
    touching = false
    await expect(slider).not.toHaveClass(/is-dragging/)
    await expectSelectedDate(page, '2026-6-12')
    await touch('touchStart', '2025-12-8')
    await expect(slider).toHaveClass(/is-dragging/)
    await expectSelectedDate(page, '2025-12-8')
    await touch('touchMove', '2025-12-4')
    await expectSelectedDate(page, '2025-12-4')
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    touching = false
    await expect(slider).not.toHaveClass(/is-dragging/)
    await expectSelectedDate(page, '2025-12-4')
  } finally {
    if (touching) await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] })
    await session.detach()
  }
})

test('the narrow rail uses available height, keeps labels apart, and fits a small viewport', async ({ page }, testInfo) => {
  await setup(page)
  await loadAllMonths(page)
  const assertLayout = async () => {
    const rail = await page.locator('.timeline-index').boundingBox()
    const track = await page.locator('.scrubber-track').boundingBox()
    const viewport = page.viewportSize()!
    expect(rail!.width).toBeCloseTo(viewport.width <= 700 ? 48 : 64, 0)
    expect(track!.y - rail!.y).toBeCloseTo(12, 0)
    expect(rail!.y + rail!.height - track!.y - track!.height).toBeCloseTo(12, 0)
    const labels = page.locator('.scrubber .year-label, .scrubber .month-label')
    await expect(page.locator('.scrubber .year-label')).not.toHaveCount(0)
    const boxes = await labels.evaluateAll(elements => elements.map(element => {
      const box = element.getBoundingClientRect()
      return { top: box.top, bottom: box.bottom, left: box.left, right: box.right }
    }).sort((a, b) => a.top - b.top))
    for (let index = 1; index < boxes.length; index++) {
      expect(boxes[index]!.top - boxes[index - 1]!.bottom).toBeGreaterThanOrEqual(4)
    }
    for (const box of boxes) {
      expect(box.left).toBeGreaterThanOrEqual(0)
      expect(box.right).toBeLessThanOrEqual(viewport.width)
      expect(box.top).toBeGreaterThanOrEqual(0)
      expect(box.bottom).toBeLessThanOrEqual(viewport.height)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }
  await assertLayout()
  await page.screenshot({ path: testInfo.outputPath('timeline-index.png') })
  await selectDate(page, '2026-6-28')
  await page.setViewportSize({ width: 360, height: 700 })
  await expectSelectedDate(page, '2026-6-28')
  await assertLayout()
  const point = await datePoint(page, '2026-6-28')
  await page.mouse.move(point.x, point.y)
  await expect(page.locator('.hover-label')).toHaveAttribute('data-key', '2026-6-28')
  const tooltip = await page.locator('.hover-label').boundingBox()
  expect(tooltip!.x).toBeGreaterThanOrEqual(0)
  expect(tooltip!.x + tooltip!.width).toBeLessThanOrEqual(360)
  await page.screenshot({ path: testInfo.outputPath('timeline-index-narrow.png') })
})

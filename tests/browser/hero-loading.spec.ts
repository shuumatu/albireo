import { test, expect, type Page } from '@playwright/test'
import sharp from 'sharp'

const titles = ['海湾的夜色', '雪线之上', '星野记录', '冬日河岸', '山野的长夜']
const heroAsset = /\/(?:hero\/(?:panorama|frame)-[1-5]-\d+h?\.webp|bg[1-5]\.jpe?g)(?:\?.*)?$/i
const photograph = await sharp({
  create: { width: 1200, height: 400, channels: 3, background: '#38617b' }
}).webp().toBuffer()

type DecodeEvent = {
  id: number
  slide: number
  kind: 'start' | 'native-ready' | 'ready' | 'error' | 'insert'
  calls: number
  ready: number
  connected: boolean
}
type ImageRecord = { id: number; slide: number; calls: number; ready: number }
type HeroProbe = {
  events: DecodeEvent[]
  violations: string[]
  records: WeakMap<HTMLImageElement, ImageRecord>
  block: (slide: number) => void
  release: (slide: number) => void
}
declare global {
  interface Window { __heroProbe: HeroProbe }
}

async function instrument(page: Page, blocked: number[] = []) {
  await page.addInitScript((initiallyBlocked) => {
    const events: DecodeEvent[] = []
    const violations: string[] = []
    const records = new WeakMap<HTMLImageElement, ImageRecord>()
    const holds = new Set(initiallyBlocked)
    const waiters = new Map<number, Array<() => void>>()
    const nativeDecode = HTMLImageElement.prototype.decode
    let nextId = 0
    function slideFor(src: string) {
      const rendition = src.match(/\/(?:panorama|frame)-(\d)-\d+h?\.webp(?:\?|$)/i)
      if (rendition) return Number(rendition[1])
      const original = src.match(/\/bg(\d)\.jpe?g(?:\?|$)/i)
      return original ? [4, 2, 5, 1, 3].indexOf(Number(original[1])) + 1 : 0
    }
    function log(image: HTMLImageElement, record: ImageRecord, kind: DecodeEvent['kind']) {
      events.push({ ...record, kind, connected: image.isConnected })
    }
    HTMLImageElement.prototype.decode = async function () {
      const slide = slideFor(this.currentSrc || this.src)
      if (!slide) return nativeDecode.call(this)
      let record = records.get(this)
      if (!record) {
        record = { id: ++nextId, slide, calls: 0, ready: 0 }
        records.set(this, record)
      }
      record.calls++
      log(this, record, 'start')
      try {
        // Keep the real browser decoder: only delay delivery of its result.
        await nativeDecode.call(this)
        log(this, record, 'native-ready')
        if (holds.has(slide)) {
          await new Promise<void>((resolve) => {
            const queue = waiters.get(slide) || []
            queue.push(resolve)
            waiters.set(slide, queue)
          })
        }
        record.ready++
        log(this, record, 'ready')
      } catch (error) {
        log(this, record, 'error')
        throw error
      }
    }
    // Observe the actual displayed elements, so decoding a separate preload
    // image cannot accidentally satisfy these assertions.
    const insertions = new WeakMap<HTMLImageElement, number>()
    new MutationObserver(() => {
      document.querySelectorAll<HTMLImageElement>('.background-images img').forEach((image) => {
        const record = records.get(image)
        if (!record || record.calls !== record.ready || !image.naturalWidth) {
          violations.push(`Displayed before decode: ${image.currentSrc || image.src}`)
          return
        }
        if (insertions.get(image) !== record.calls) {
          insertions.set(image, record.calls)
          log(image, record, 'insert')
        }
      })
    }).observe(document, {
      childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'srcset']
    })
    window.__heroProbe = {
      events, violations, records,
      block(slide) { holds.add(slide) },
      release(slide) {
        holds.delete(slide)
        waiters.get(slide)?.forEach((resolve) => resolve())
        waiters.delete(slide)
      }
    }
  }, blocked)
}

async function fixture(page: Page, options: { blocked?: number[]; failSlide?: number } = {}) {
  await instrument(page, options.blocked)
  let failed = false
  await page.route(heroAsset, async (route) => {
    // Vite also requests asset URLs as JS import modules.
    if (route.request().resourceType() !== 'image') return route.continue()
    const path = new URL(route.request().url()).pathname
    const match = path.match(/panorama-(\d)-/)
    if (!failed && options.failSlide && Number(match?.[1]) === options.failSlide) {
      failed = true
      return route.fulfill({ status: 503, body: 'Unavailable' })
    }
    return route.fulfill({ contentType: 'image/webp', body: photograph })
  })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
}

async function countEvents(page: Page, slide: number, kind: DecodeEvent['kind']) {
  return page.evaluate(({ slide, kind }) =>
    window.__heroProbe.events.filter((event) => event.slide === slide && event.kind === kind).length,
  { slide, kind })
}
async function release(page: Page, slide: number) {
  await page.evaluate((slide) => window.__heroProbe.release(slide), slide)
}
async function assertDecoded(page: Page) {
  expect(await page.evaluate(() => window.__heroProbe.violations)).toEqual([])
  const images = await page.locator('.background-images img').evaluateAll((images) => images.map((element) => {
    const image = element as HTMLImageElement
    return { record: window.__heroProbe.records.get(image), complete: image.complete, width: image.naturalWidth }
  }))
  expect(images.length).toBeGreaterThan(0)
  for (const image of images) {
    expect(image.complete).toBe(true)
    expect(image.width).toBeGreaterThan(0)
    expect(image.record).toBeDefined()
    expect(image.record!.ready).toBe(image.record!.calls)
    expect(image.record!.ready).toBeGreaterThan(0)
  }
}
async function assertSlide(page: Page, slide: number) {
  await expect(page.locator('.hero-caption h2')).toHaveText(titles[slide - 1]!)
  await expect(page.locator('.slide-number')).toHaveText(String(slide).padStart(2, '0'))
  await expect(page.locator('.slide-controls button').nth(slide - 1)).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.hero')).toHaveAttribute('aria-busy', 'false')
  await expect(page.locator('.background-images img').last()).toHaveAttribute('alt', titles[slide - 1]!)
  await assertDecoded(page)
}

test('initial photo stays detached until the displayed image has finished decoding', async ({ page }) => {
  await fixture(page, { blocked: [1] })
  await expect.poll(() => countEvents(page, 1, 'native-ready')).toBeGreaterThan(0)
  await expect(page.locator('.hero')).toHaveAttribute('aria-busy', 'true')
  await expect(page.locator('.background-images img')).toHaveCount(0)
  const firstDecode = await page.evaluate(() => window.__heroProbe.events.find((event) => event.slide === 1 && event.kind === 'start'))
  expect(firstDecode?.connected).toBe(false)
  await release(page, 1)
  await assertSlide(page, 1)
  expect(await page.locator('.background-images img').last().evaluate((image) => window.__heroProbe.records.get(image as HTMLImageElement)?.id)).toBe(firstDecode?.id)
})

test('slow next photo keeps the complete current photo and caption visible', async ({ page }) => {
  await fixture(page, { blocked: [2] })
  await assertSlide(page, 1)
  const before = await page.locator('.background-images img').last().getAttribute('src')
  await page.locator('.slide-controls button').nth(1).click()
  await expect.poll(() => countEvents(page, 2, 'native-ready')).toBeGreaterThan(0)
  await expect(page.locator('.hero')).toHaveAttribute('aria-busy', 'true')
  await expect(page.locator('.hero-caption h2')).toHaveText(titles[0]!)
  await expect(page.locator('.background-images img').last()).toHaveAttribute('src', before!)
  await assertDecoded(page)
  await release(page, 2)
  await assertSlide(page, 2)
})

test('rapid selections commit only the latest intent despite out-of-order decoding', async ({ page }) => {
  await fixture(page, { blocked: [2, 3, 5] })
  await assertSlide(page, 1)
  for (const slide of [2, 3, 5]) {
    await page.locator('.slide-controls button').nth(slide - 1).click()
    await expect.poll(() => countEvents(page, slide, 'native-ready')).toBeGreaterThan(0)
  }
  await release(page, 5)
  await assertSlide(page, 5)
  await release(page, 3)
  await release(page, 2)
  await expect.poll(() => countEvents(page, 2, 'ready')).toBeGreaterThan(0)
  await expect.poll(() => countEvents(page, 3, 'ready')).toBeGreaterThan(0)
  await assertSlide(page, 5)
  expect(await page.evaluate(() => window.__heroProbe.events.filter((event) => event.kind === 'insert' && [2, 3].includes(event.slide)))).toEqual([])
  // Returning to the already visible frame also cancels an outstanding request.
  await page.evaluate(() => window.__heroProbe.block(4))
  await page.locator('.slide-controls button').nth(3).click()
  await expect.poll(() => countEvents(page, 4, 'native-ready')).toBeGreaterThan(0)
  await page.locator('.slide-controls button').nth(4).click()
  await release(page, 4)
  await expect.poll(() => countEvents(page, 4, 'ready')).toBeGreaterThan(0)
  await assertSlide(page, 5)
})

test('returning to a cached frame decodes again before the same image is displayed', async ({ page }) => {
  await fixture(page)
  await assertSlide(page, 1)
  const initialId = await page.locator('.background-images img').last().evaluate((image) => window.__heroProbe.records.get(image as HTMLImageElement)!.id)
  const initialCalls = await countEvents(page, 1, 'start')
  await page.locator('.slide-controls button').nth(1).click()
  await assertSlide(page, 2)
  // Wait for the completed crossfade to remove the previous visible element.
  await expect(page.locator('.background-images img')).toHaveCount(1)
  await page.evaluate(() => window.__heroProbe.block(1))
  await page.locator('.slide-controls button').first().click()
  await expect.poll(() => countEvents(page, 1, 'start')).toBeGreaterThan(initialCalls)
  await expect(page.locator('.hero')).toHaveAttribute('aria-busy', 'true')
  await expect(page.locator('.hero-caption h2')).toHaveText(titles[1]!)
  await expect(page.locator('.background-images img').last()).toHaveAttribute('alt', titles[1]!)
  await release(page, 1)
  await assertSlide(page, 1)
  expect(await page.locator('.background-images img').last().evaluate((image) => window.__heroProbe.records.get(image as HTMLImageElement)!.id)).toBe(initialId)
})

test('a failed selection preserves the old frame and can be retried', async ({ page }) => {
  await fixture(page, { failSlide: 3 })
  await assertSlide(page, 1)
  await page.locator('.slide-controls button').nth(2).click()
  await expect(page.locator('.background-error')).toBeVisible()
  await expect(page.locator('.hero-caption h2')).toHaveText(titles[0]!)
  await expect(page.locator('.background-images img').last()).toHaveAttribute('alt', titles[0]!)
  await assertDecoded(page)
  await page.locator('.background-error').getByRole('button', { name: /重试/ }).click()
  await assertSlide(page, 3)
  await expect(page.locator('.background-error')).toHaveCount(0)
})

test('brief mouse hover does not decode extra frames and keyboard focus selects immediately', async ({ page, isMobile }) => {
  test.skip(Boolean(isMobile), 'Mouse hover is covered on desktop only')
  await fixture(page, { blocked: [3] })
  await assertSlide(page, 1)
  const before = await countEvents(page, 2, 'start')
  await page.locator('.slide-controls button').evaluateAll((buttons) => {
    buttons[1]!.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }))
    buttons[1]!.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }))
  })
  // Exceed the hover debounce interval after leaving the button.
  await page.waitForTimeout(160)
  expect(await countEvents(page, 2, 'start')).toBe(before)
  await assertSlide(page, 1)
  await page.locator('.slide-controls button').nth(2).focus()
  await expect.poll(() => countEvents(page, 3, 'native-ready')).toBeGreaterThan(0)
  await expect(page.locator('.hero')).toHaveAttribute('aria-busy', 'true')
  await release(page, 3)
  await assertSlide(page, 3)
})

test('navigation while decoding removes the hero without a late insertion or unhandled error', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await fixture(page, { blocked: [2] })
  await assertSlide(page, 1)
  await page.locator('.slide-controls button').nth(1).click()
  await expect.poll(() => countEvents(page, 2, 'native-ready')).toBeGreaterThan(0)
  await page.locator('.site-header a[href="/timeline"]').click()
  await expect(page).toHaveURL(/\/timeline$/)
  await expect(page.locator('.hero')).toHaveCount(0)
  await release(page, 2)
  await expect.poll(() => countEvents(page, 2, 'ready')).toBeGreaterThan(0)
  await expect(page.locator('.hero')).toHaveCount(0)
  expect(await countEvents(page, 2, 'insert')).toBe(0)
  expect(errors).toEqual([])
  await page.locator('.site-header nav a[href="/"]').click()
  await assertSlide(page, 1)
})

test('touch selection retains horizontal position and reduced motion uses no image crossfade', async ({ page, isMobile }, testInfo) => {
  test.skip(!isMobile && testInfo.project.name !== 'reduced-motion', 'Touch and reduced-motion coverage')
  await fixture(page)
  await assertSlide(page, 1)
  const button = page.locator('.slide-controls button').nth(4)
  if (isMobile) await button.tap()
  else await button.focus()
  await assertSlide(page, 5)
  if (isMobile) {
    const position = await page.locator('.hero').evaluate((hero) => getComputedStyle(hero).getPropertyValue('--background-pan'))
    await page.locator('.hero').dispatchEvent('pointermove', { pointerType: 'touch', clientX: 1, clientY: 300 })
    expect(await page.locator('.hero').evaluate((hero) => getComputedStyle(hero).getPropertyValue('--background-pan'))).toBe(position)
  }
  if (testInfo.project.name === 'reduced-motion') {
    expect(await page.locator('.background-images').evaluate((images) => images.getAnimations({ subtree: true }).length)).toBe(0)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('real panorama assets choose a sharp resolution and survive rapid switching and keyboard panning', async ({ page }, testInfo) => {
  await instrument(page)
  // Intentionally use the unmodified image files served by the existing fixture server.
  await page.goto('/')
  await assertSlide(page, 1)
  const dimensions = await page.locator('.background-images img.is-current').evaluate((element) => {
    const image = element as HTMLImageElement
    const rect = image.getBoundingClientRect()
    return {
      width: image.naturalWidth, height: image.naturalHeight,
      renderedWidth: rect.width, renderedHeight: rect.height,
      dpr: window.devicePixelRatio, src: image.currentSrc
    }
  })
  const selectedHeight = Number(dimensions.src.match(/-(\d+)h\.webp/)?.[1])
  expect(dimensions.height).toBe(selectedHeight)
  const neededHeight = Math.max(
    dimensions.renderedHeight,
    dimensions.renderedWidth * 2160 / 8731
  ) * Math.min(2, Math.max(1, dimensions.dpr))
  expect(selectedHeight).toBeGreaterThanOrEqual(Math.min(neededHeight, 1920))
  if (selectedHeight > 960) {
    expect(selectedHeight === 1440 ? 960 : 1440).toBeLessThan(neededHeight)
  }
  expect(dimensions.width / dimensions.height).toBeCloseTo(8731 / 2160, 2)
  await page.locator('.featured-hero').screenshot({ path: testInfo.outputPath('panorama-initial.png') })

  await page.locator('.hero').focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('.background-images img.is-current')).toHaveCSS('object-position', '55% 50%')
  await page.keyboard.press('ArrowLeft')
  await expect(page.locator('.background-images img.is-current')).toHaveCSS('object-position', '50% 50%')
  await page.locator('.slide-controls button').evaluateAll((buttons) => {
    for (const index of [1, 2, 3, 1, 4]) (buttons[index] as HTMLButtonElement).click()
  })
  await assertSlide(page, 5)
  await expect(page.locator('.background-images img')).toHaveCount(1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.locator('.featured-hero').screenshot({ path: testInfo.outputPath('panorama-final.png') })
})

test('decode timeout preserves the current photo and retry replaces the timed-out image', async ({ page }) => {
  await page.clock.install()
  await fixture(page, { blocked: [2] })
  await assertSlide(page, 1)
  await page.locator('.slide-controls button').nth(1).click()
  await expect.poll(() => countEvents(page, 2, 'native-ready')).toBeGreaterThan(0)
  const timedOutId = await page.evaluate(() => window.__heroProbe.events.find((event) => event.slide === 2 && event.kind === 'start')!.id)
  await page.clock.fastForward(21000)
  await expect(page.locator('.background-error')).toBeVisible()
  await expect(page.locator('.hero')).toHaveAttribute('aria-busy', 'false')
  await expect(page.locator('.hero-caption h2')).toHaveText(titles[0]!)
  await expect(page.locator('.background-images img.is-current')).toHaveAttribute('alt', titles[0]!)
  await assertDecoded(page)
  await release(page, 2)
  await expect.poll(() => countEvents(page, 2, 'ready')).toBeGreaterThan(0)
  expect(await countEvents(page, 2, 'insert')).toBe(0)
  await page.locator('.background-error').getByRole('button', { name: /重试/ }).click()
  await assertSlide(page, 2)
  expect(await page.locator('.background-images img.is-current').evaluate((image) => window.__heroProbe.records.get(image as HTMLImageElement)!.id)).not.toBe(timedOutId)
})

test('idle preloading requests only one neighbour and pauses while the document is hidden', async ({ page }) => {
  const requested: number[] = []
  page.on('request', (request) => {
    const match = new URL(request.url()).pathname.match(/\/panorama-(\d)-\d+h\.webp$/)
    if (match && request.resourceType() === 'image') requested.push(Number(match[1]))
  })
  const start = new Date('2026-10-03T12:00:00Z')
  await page.clock.install({ time: start })
  await page.clock.pauseAt(new Date(start.getTime() + 1000))
  await fixture(page)
  await assertSlide(page, 1)
  expect(requested).toEqual([1])
  await page.clock.fastForward(1199)
  expect(requested).toEqual([1])
  await page.clock.fastForward(1)
  await expect.poll(() => countEvents(page, 2, 'ready')).toBeGreaterThan(0)
  expect(requested).toEqual([1, 2])
  await page.clock.fastForward(5000)
  expect(requested).toEqual([1, 2])

  await page.locator('.slide-controls button').nth(2).click()
  await assertSlide(page, 3)
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  // Hiding also finishes the in-flight fade; its completion must not start work.
  await page.clock.fastForward(10000)
  expect(requested).toEqual([1, 2, 3])
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await page.clock.fastForward(1200)
  await expect.poll(() => countEvents(page, 4, 'ready')).toBeGreaterThan(0)
  expect(requested).toEqual([1, 2, 3, 4])
  await assertSlide(page, 3)
})

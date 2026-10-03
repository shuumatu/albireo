import { test, expect, type Page } from '@playwright/test'
import sharp from 'sharp'
import type { BackgroundSlide } from '../../src/types/background'
import type {} from '../fixtures/background-slideshow'

const pixels = await sharp({
  create: { width: 900, height: 300, channels: 3, background: '#345e78' }
}).webp().toBuffer()
const photo = (id: string, title = id): BackgroundSlide => ({
  id, title, src: `https://cdn.example.test/${id}.webp`
})
const a = photo('a'), b = photo('b'), c = photo('c')

async function setup(page: Page) {
  await page.addInitScript(() => {
    const nativeDecode = HTMLImageElement.prototype.decode
    const releases = new Map<string, () => void>()
    window.heldBackgrounds = []
    window.releaseBackground = (src) => releases.get(src)?.()
    HTMLImageElement.prototype.decode = async function () {
      const src = this.src
      await nativeDecode.call(this)
      if (src.includes('?hold')) {
        await new Promise<void>((resolve) => {
          releases.set(src, resolve)
          window.heldBackgrounds.push(src)
        })
      }
    }
  })
  await page.route('https://cdn.example.test/**', (route) =>
    route.request().url().includes('fail.webp')
      ? route.fulfill({ status: 503, body: 'Unavailable' })
      : route.fulfill({ contentType: 'image/webp', body: pixels }))
  await page.goto('/tests/fixtures/background-slideshow.html')
  await page.waitForFunction(() => Boolean(window.backgroundTest))
}

async function setSlides(page: Page, slides: BackgroundSlide[], owner: 'primary' | 'secondary' = 'primary') {
  await page.evaluate(({ owner, slides }) => window.backgroundTest.setSlides(owner, slides), { owner, slides })
}
async function shown(page: Page, slide: BackgroundSlide, owner = 'primary') {
  const root = page.locator(`#${owner}`)
  await expect(root.locator('[data-current]')).toHaveText(slide.id)
  await expect(root.locator('.background-image.is-current')).toHaveAttribute('src', slide.src)
  await expect(root.locator('.background-slideshow')).toHaveAttribute('aria-busy', 'false')
}

test('an empty reusable instance accepts an asynchronously supplied remote URL without dimensions', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await setup(page)
  await expect(page.locator('#primary [data-empty]')).toBeVisible()
  await expect(page.locator('#primary img')).toHaveCount(0)
  await setSlides(page, [a])
  await shown(page, a)
  await expect(page.locator('#primary [data-empty]')).toHaveCount(0)
  await expect(page.locator('#primary .pan-cue')).toHaveCount(0)
  expect(await page.locator('#primary .background-slideshow').getAttribute('tabindex')).toBeNull()
  expect(await page.evaluate(() => window.backgroundTest.events)).toContainEqual({ owner: 'primary', kind: 'change', id: 'a' })
  expect(errors).toEqual([])
})

test('reordering, metadata edits and two IDs sharing one URL preserve the decoded node', async ({ page }) => {
  await setup(page)
  await setSlides(page, [a, b])
  await shown(page, a)
  await page.evaluate(() => window.backgroundTest.select('primary', 'b'))
  await shown(page, b)
  await page.locator('#primary .is-current').evaluate((image) => image.setAttribute('data-same-node', 'yes'))
  const edited = { ...b, title: 'Edited remotely', alt: 'Updated description' }
  await setSlides(page, [edited, a])
  await shown(page, edited)
  await expect(page.locator('#primary [data-index]')).toHaveText('0')
  await expect(page.locator('#primary [data-title]')).toHaveText(edited.title)
  await expect(page.locator('#primary .is-current')).toHaveAttribute('alt', edited.alt)
  await expect(page.locator('#primary .is-current')).toHaveAttribute('data-same-node', 'yes')
  const shared = { ...edited, id: 'different-id', title: 'Shared source' }
  await setSlides(page, [shared])
  await shown(page, shared)
  await expect(page.locator('#primary .is-current')).toHaveAttribute('data-same-node', 'yes')
})

test('replacing a URL on the same ID keeps the old image until the new source is decoded', async ({ page }) => {
  await setup(page)
  await setSlides(page, [a])
  await shown(page, a)
  const updated = { ...a, title: 'Replacement', src: `${a.src}?hold=replacement` }
  await setSlides(page, [updated])
  await page.waitForFunction((src) => window.heldBackgrounds.includes(src), updated.src)
  await expect(page.locator('#primary .background-slideshow')).toHaveAttribute('aria-busy', 'true')
  await expect(page.locator('#primary .is-current')).toHaveAttribute('src', a.src)
  await expect(page.locator('#primary [data-title]')).toHaveText(a.title!)
  await page.evaluate((src) => window.releaseBackground(src), updated.src)
  await shown(page, updated)
  await expect(page.locator('#primary [data-title]')).toHaveText('Replacement')
})

test('deleted pending selections cannot return, and clearing during a fade allows safe reuse', async ({ page }) => {
  await setup(page)
  const held = { ...b, src: `${b.src}?hold=deleted` }
  await setSlides(page, [a, held])
  await shown(page, a)
  await page.locator('#primary [data-select="b"]').click()
  await page.waitForFunction((src) => window.heldBackgrounds.includes(src), held.src)
  await setSlides(page, [c, a])
  // The visible a survives removal of the pending b, preserving selection by ID.
  await shown(page, a)
  await page.evaluate((src) => window.releaseBackground(src), held.src)
  await shown(page, a)
  await page.locator('#primary [data-select="c"]').click()
  await shown(page, c)
  await setSlides(page, [])
  await expect(page.locator('#primary img')).toHaveCount(0)
  await expect(page.locator('#primary [data-empty]')).toBeVisible()
  await setSlides(page, [b])
  await shown(page, b)
  await page.waitForTimeout(300)
  await expect(page.locator('#primary img')).toHaveCount(1)
  await shown(page, b)
  expect(await page.evaluate(() => window.backgroundTest.events.filter((event) => event.id === 'b' && event.kind === 'change').length)).toBe(1)
})

test('two instances isolate selection, errors and clearing', async ({ page }) => {
  await setup(page)
  await setSlides(page, [a, b])
  await setSlides(page, [a, photo('fail')], 'secondary')
  await shown(page, a)
  await shown(page, a, 'secondary')
  await page.locator('#primary [data-select="b"]').click()
  await shown(page, b)
  await shown(page, a, 'secondary')
  await page.locator('#secondary [data-select="fail"]').click()
  await expect(page.locator('#secondary .background-error')).toBeVisible()
  await expect(page.locator('#primary .background-error')).toHaveCount(0)
  await setSlides(page, [], 'secondary')
  await expect(page.locator('#secondary img')).toHaveCount(0)
  await shown(page, b)
  expect(await page.evaluate(() => window.backgroundTest.events)).toContainEqual({ owner: 'secondary', kind: 'error', id: 'fail' })
})

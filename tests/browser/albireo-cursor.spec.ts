import { test, expect, type Page, type Locator } from '@playwright/test'

// Do not let headless Chrome hide the very scrollbars under test.
test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } })
const state = (page: Page) => page.locator('html')
const artwork = /^url\(.+\) 16 16, none$/
async function expectArtwork(page: Page, target: Locator, name?: string) {
  await expect(state(page)).toHaveAttribute('data-albireo-cursor-active', '')
  await expect.poll(() => target.evaluate(e => getComputedStyle(e).cursor)).toMatch(artwork)
  if (name) await expect(state(page)).toHaveAttribute('data-albireo-cursor-state', name)
}
async function surface(page: Page) {
  await page.goto('/login')
  await expect(page.getByPlaceholder('请输入用户名', { exact: true })).toBeVisible()
  await page.evaluate(() => {
    const panel = document.createElement('section')
    panel.id = 'cursor-test-surface'
    panel.style.cssText = 'position:fixed;inset:100px 40px auto;z-index:999999;background:#eee;color:#111;padding:20px;display:flex;gap:20px;flex-wrap:wrap'
    panel.innerHTML = '<button id="cursor-link"><span>Link target</span></button><input id="cursor-input" aria-label="Cursor text"><button id="cursor-disabled" disabled>Disabled</button><div id="cursor-state" style="width:120px;height:70px">State target</div><select id="cursor-select"><option>Choice one</option><option>Choice two</option></select>'
    panel.querySelector('#cursor-link')!.addEventListener('click', () => panel.dataset.clicked = 'true')
    document.body.append(panel)
  })
}

test('real PNG cursors have visible artwork and a center hotspot; links and text still work', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Mouse only')
  await surface(page)
  const link = page.locator('#cursor-link span'), input = page.locator('#cursor-input')
  await link.hover()
  await expectArtwork(page, link, 'hover')
  const pixels = await link.evaluate(async e => {
    const url = getComputedStyle(e).cursor.match(/url\("?([^"\)]+)"?\)/)![1]!
    const image = new Image(); image.src = url; await image.decode()
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height
    const context = canvas.getContext('2d')!; context.drawImage(image, 0, 0)
    const rgba = context.getImageData(0, 0, image.width, image.height).data
    return { size: image.width, colored: rgba.filter((v, i) => i % 4 === 3 && v > 0).length }
  })
  expect(pixels.size).toBe(32)
  expect(pixels.colored).toBeGreaterThan(50)
  await expect(page.locator('canvas.albireo-cursor')).toHaveCount(0)
  await link.click()
  await expect(page.locator('#cursor-test-surface')).toHaveAttribute('data-clicked', 'true')
  await input.hover()
  await expectArtwork(page, input, 'text')
  await input.fill('Albireo')
  await expect(input).toHaveValue('Albireo')
  await page.locator('#cursor-disabled').hover({ force: true })
  await expectArtwork(page, page.locator('#cursor-disabled'), 'blocked')
})

test('CSS cursor semantics and stationary state changes remain independent of the applied artwork', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Mouse only')
  await surface(page)
  const target = page.locator('#cursor-state')
  await target.hover()
  for (const [native, name] of [['wait', 'busy'], ['progress', 'working'], ['grab', 'move'], ['grabbing', 'move'], ['ew-resize', 'resize'], ['ns-resize', 'resize'], ['text', 'text'], ['crosshair', 'precision'], ['not-allowed', 'blocked']]) {
    await target.evaluate((e, value) => { (e as HTMLElement).style.cursor = value! }, native)
    await expectArtwork(page, target, name)
  }
  await target.evaluate(e => e.setAttribute('aria-busy', 'true'))
  await expectArtwork(page, target, 'working')
  await target.evaluate(e => { e.removeAttribute('aria-busy'); e.setAttribute('aria-disabled', 'true') })
  await expectArtwork(page, target, 'blocked')
  expect(await target.evaluate(e => (e as HTMLElement).style.cursor)).toBe('not-allowed')
})

test('photo zoom and select controls use Albireo while deliberate cursor hiding still works', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Mouse only')
  await surface(page)
  const target = page.locator('#cursor-state')
  for (const native of ['zoom-in', 'zoom-out']) {
    await target.evaluate((e, value) => { (e as HTMLElement).style.cursor = value }, native)
    await target.hover()
    await expectArtwork(page, target, native)
  }
  await page.locator('#cursor-select').hover()
  await expectArtwork(page, page.locator('#cursor-select'), 'hover')
  await page.locator('#cursor-select').selectOption({ index: 1 })
  await expect(page.locator('#cursor-select')).toHaveValue('Choice two')
  await target.evaluate(e => { (e as HTMLElement).style.cursor = 'none' })
  await target.hover()
  await expect.poll(() => target.evaluate(e => getComputedStyle(e).cursor)).toBe('none')
  await page.locator('#cursor-input').hover()
  await expectArtwork(page, page.locator('#cursor-input'), 'text')
})

test('pressed controls keep artwork through active styles, focus, capture and cancellation', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Mouse only')
  await surface(page)
  await page.addStyleTag({ content: '#cursor-test-surface #cursor-link:active, #cursor-test-surface #cursor-link:focus, #cursor-test-surface #cursor-link:active * { cursor: default !important }' })
  await page.evaluate(() => {
    const samples: string[] = []
    ;(window as any).pressedCursors = samples
    for (const event of ['pointerdown', 'mousedown', 'mouseup', 'click']) document.addEventListener(event, e => {
      samples.push(getComputedStyle(e.target as Element).cursor)
    })
  })
  const target = page.locator('#cursor-link span')
  await target.hover()
  for (let i = 0; i < 3; i++) {
    await page.mouse.down()
    await expectArtwork(page, target)
    await page.mouse.up()
  }
  const samples = await page.evaluate(() => (window as any).pressedCursors as string[])
  expect(samples.length).toBeGreaterThanOrEqual(12)
  expect(samples.every(value => artwork.test(value))).toBe(true)
  await target.dispatchEvent('pointercancel', { pointerType: 'mouse' })
  await expectArtwork(page, target)
  await page.keyboard.press('Tab')
  await expect(state(page)).toHaveAttribute('data-albireo-cursor-active', '')
})

test('slight drags on images do not start OS drag-and-drop or restore an arrow', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Mouse only')
  await surface(page)
  await page.evaluate(() => {
    const image = document.createElement('img')
    image.id = 'cursor-photo'; image.src = '/src/assets/cursor-default.png'
    image.style.cssText = 'position:fixed;left:100px;top:300px;width:100px;height:100px;z-index:1000000'
    document.body.append(image)
    document.addEventListener('dragstart', e => { image.dataset.prevented = String(e.defaultPrevented) })
  })
  const image = page.locator('#cursor-photo')
  await image.hover()
  await page.mouse.down()
  await page.mouse.move(170, 370, { steps: 5 })
  await expect(image).toHaveAttribute('data-prevented', 'true')
  await expectArtwork(page, image)
  await page.mouse.up()
})

test('pointer capture and document-managed drags keep the originating appearance', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Mouse only')
  await surface(page)
  const target = page.locator('#cursor-state')
  await target.evaluate(e => {
    e.setAttribute('role', 'slider'); e.setAttribute('aria-orientation', 'horizontal')
    e.addEventListener('pointerdown', event => e.setPointerCapture((event as PointerEvent).pointerId))
    e.addEventListener('pointermove', event => { if ((event as PointerEvent).buttons) e.setAttribute('data-dragged', 'true') })
  })
  await target.hover()
  await page.mouse.down()
  await page.mouse.move(900, 300, { steps: 6 })
  await expectArtwork(page, target, 'resize')
  await expect(target).toHaveAttribute('data-dragged', 'true')
  await page.mouse.up()
  await page.locator('#cursor-input').hover()
  await expectArtwork(page, page.locator('#cursor-input'), 'text')
})

test('original native ranges still change their value with Albireo during dragging', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Mouse only')
  await surface(page)
  await page.evaluate(() => {
    const range = document.createElement('input')
    range.type = 'range'; range.id = 'cursor-range'; range.value = '0'
    range.style.cssText = 'position:fixed;left:100px;top:300px;width:300px;z-index:1000000'
    document.body.append(range)
  })
  const range = page.locator('#cursor-range'), box = (await range.boundingBox())!
  await page.mouse.move(box.x + 8, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * .8, box.y + box.height / 2, { steps: 8 })
  await expectArtwork(page, range, 'resize')
  await expect.poll(() => range.inputValue().then(Number)).toBeGreaterThan(70)
  await page.mouse.up()
})

test('scrollbar replacements support hover, captured dragging, keyboard and wheel with artwork', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Mouse only')
  await surface(page)
  await page.evaluate(() => {
    const scroller = document.createElement('div')
    scroller.id = 'cursor-scroller'
    scroller.style.cssText = 'position:fixed;left:100px;top:300px;width:300px;height:140px;border:4px solid #777;overflow:scroll;z-index:1000000'
    scroller.innerHTML = '<div style="width:900px;height:420px;background:#ddd">Scrollable content</div>'
    document.body.append(scroller)
  })
  const scroller = page.locator('#cursor-scroller')
  for (const [axis, property] of [['horizontal', 'scrollLeft'], ['vertical', 'scrollTop']] as const) {
    const bar = page.locator(`[role=scrollbar][aria-controls=cursor-scroller][aria-orientation=${axis}]`)
    await expect(bar).toBeVisible()
    await expect.poll(() => scroller.evaluate(e => getComputedStyle(e).scrollbarWidth)).toBe('none')
    const thumb = bar.locator('.albireo-scrollbar-thumb'), box = (await thumb.boundingBox())!
    await thumb.hover()
    await expectArtwork(page, thumb, 'resize')
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + (axis === 'horizontal' ? 95 : 0), box.y + box.height / 2 + (axis === 'vertical' ? 70 : 0), { steps: 8 })
    await expectArtwork(page, thumb, 'resize')
    await expect.poll(() => scroller.evaluate((e, property) => e[property], property)).toBeGreaterThan(100)
    await page.mouse.up()
    await bar.focus(); await page.keyboard.press('Home')
    await expect.poll(() => scroller.evaluate((e, property) => e[property], property)).toBe(0)
    await page.keyboard.press('End')
    await expect.poll(() => scroller.evaluate((e, property) => e[property], property)).toBeGreaterThan(100)
  }
  await scroller.hover()
  await page.mouse.wheel(0, -300)
  await expect.poll(() => scroller.evaluate(e => e.scrollTop)).toBeLessThan(200)
})

test('page bottom scrollbar uses Albireo throughout drag and returns to text correctly', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Mouse only')
  await surface(page)
  await page.evaluate(() => { document.body.style.width = '300vw'; document.documentElement.style.overflowX = 'scroll' })
  const rootId = await state(page).getAttribute('id')
  const bar = page.locator(`[role=scrollbar][aria-controls="${rootId}"][aria-orientation=horizontal]`)
  await expect(bar).toBeVisible()
  const thumb = bar.locator('.albireo-scrollbar-thumb'), box = (await thumb.boundingBox())!
  await thumb.hover()
  await expectArtwork(page, thumb, 'resize')
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 250, box.y + box.height / 2, { steps: 8 })
  await expectArtwork(page, thumb, 'resize')
  await expect.poll(() => page.evaluate(() => scrollX)).toBeGreaterThan(100)
  await page.mouse.up()
  await page.locator('#cursor-input').hover()
  await expectArtwork(page, page.locator('#cursor-input'), 'text')
})

test('animation stays bounded, respects reduced motion and disables for touch or forced colors', async ({ page, isMobile }) => {
  await surface(page)
  if (isMobile) {
    await page.locator('#cursor-input').tap()
    await page.locator('#cursor-input').fill('touch still works')
    await expect(state(page)).not.toHaveAttribute('data-albireo-cursor-active')
    await expect(page.locator('.albireo-scrollbars')).toHaveCount(0)
    return
  }
  const target = page.locator('#cursor-state')
  await target.evaluate(e => { (e as HTMLElement).style.cursor = 'wait' })
  await target.hover()
  await expectArtwork(page, target, 'busy')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(state(page)).toHaveAttribute('data-albireo-cursor-motion', 'reduced')
  const still = await target.evaluate(e => getComputedStyle(e).cursor)
  await page.waitForTimeout(180)
  expect(await target.evaluate(e => getComputedStyle(e).cursor)).toBe(still)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await expect.poll(() => target.evaluate(e => getComputedStyle(e).cursor)).not.toBe(still)
  await page.emulateMedia({ forcedColors: 'active' })
  await expect(state(page)).not.toHaveAttribute('data-albireo-cursor-active')
  await expect(page.locator('[data-albireo-scrollable]')).toHaveCount(0)
  await page.emulateMedia({ forcedColors: 'none' })
  await target.hover()
  await expectArtwork(page, target, 'busy')
})

test('late styles and :active retain cursor semantics without exposing the system cursor', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Mouse only')
  await surface(page)
  const target = page.locator('#cursor-state')
  await target.hover()
  const sheet = await page.addStyleTag({ content: '@media (min-width:1px) { #cursor-state { cursor:crosshair } #cursor-state:active { cursor:grabbing } }' })
  await expectArtwork(page, target, 'precision')
  await page.mouse.down()
  await expectArtwork(page, target, 'move')
  await page.mouse.up()
  await expectArtwork(page, target, 'precision')
  await sheet.evaluate(e => { e.textContent = '#cursor-state { cursor:wait !important }' })
  await expectArtwork(page, target, 'busy')
})

test('cursor bitmaps and hotspots stay within Chrome viewport limits at the edges', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Mouse only')
  await surface(page)
  const viewport = page.viewportSize()!
  for (const point of [{ x: 2, y: 300 }, { x: viewport.width - 2, y: 300 }, { x: 400, y: 2 }, { x: 400, y: viewport.height - 2 }]) {
    await page.mouse.move(point.x, point.y)
    await expect.poll(() => page.evaluate(async point => {
      const element = document.elementFromPoint(point.x, point.y)!
      const match = getComputedStyle(element).cursor.match(/url\("?([^"\)]+)"?\) (\d+) (\d+), none/)
      if (!match) return false
      const image = new Image(); image.src = match[1]!; await image.decode()
      const left = point.x - Number(match[2]), top = point.y - Number(match[3])
      return left >= 0 && top >= 0 && left + image.width <= innerWidth && top + image.height <= innerHeight
    }, point)).toBe(true)
  }
})

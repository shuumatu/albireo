import { test, expect, type Page } from '@playwright/test'
import sharp from 'sharp'
import { readFile } from 'node:fs/promises'

const photograph = await readFile(
  new URL('../../src/assets/hero/frame-2-1920.webp', import.meta.url)
)
const original = await sharp(photograph).resize(2880).webp().toBuffer()
const dimensions = await sharp(original).metadata()
const metadata = {
  objectKey: 'viewer-test',
  fileName: 'snow-mountain.webp',
  imageUrl: '/__photo-test/original.webp',
  displayUrl: '/src/assets/hero/frame-2-1920.webp',
  width: dimensions.width,
  height: dimensions.height,
  fileSize: original.length,
  title: '雪线之上',
  description: '远处的山峰与近处的光影，共同构成这一刻的记忆。',
  status: 'done',
  type: '摄影',
  shotAt: '2026-09-12T18:30:00',
  createdAt: '2026-09-13T09:00:00'
}
async function setup(
  page: Page,
  options: { fail?: boolean; delay?: number; noDimensions?: boolean } = {}
) {
  await page.route('**/api/metadata/image/info/**', (route) =>
    route.fulfill({
      json: {
        ...metadata,
        ...(options.noDimensions ? { width: null, height: null } : {})
      }
    })
  )
  await page.route('**/__photo-test/original.webp', async (route) => {
    if (options.delay)
      await new Promise((resolve) => setTimeout(resolve, options.delay))
    if (options.fail) await route.fulfill({ status: 503, body: 'Unavailable' })
    else await route.fulfill({ contentType: 'image/webp', body: original })
  })
  await page.goto('/image/viewer-test')
  await expect(
    page.getByRole('button', { name: '详细浏览照片：雪线之上' })
  ).toBeEnabled()
}
async function open(page: Page) {
  await page.getByRole('button', { name: '详细浏览照片：雪线之上' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(
    page.getByRole('button', { name: '放大照片', exact: true })
  ).toBeEnabled()
}
async function zoomPercent(page: Page) {
  return parseInt(await page.locator('.photo-viewer-percent').innerText())
}

test('HEIC and HEIF browse the full-size JPEG without requesting the raw file', async ({
  page
}) => {
  const jpeg = await sharp(photograph).jpeg({ quality: 95 }).toBuffer()
  const size = await sharp(jpeg).metadata()
  let rawRequests = 0
  await page.route('**/__photo-test/raw/**', (route) => {
    rawRequests++
    return route.fulfill({ status: 415, body: 'HEIC decoding is unsupported' })
  })
  await page.route('**/__photo-test/display.jpg', (route) =>
    route.fulfill({ contentType: 'image/jpeg', body: jpeg })
  )
  for (const format of [
    {
      fileName: 'IMG_001.HEIC',
      mimeType: null,
      imageUrl: '/__photo-test/raw/source.HEIC?signature=test'
    },
    {
      fileName: 'opaque',
      mimeType: 'image/heif-sequence',
      imageUrl: '/__photo-test/raw/opaque'
    },
    {
      fileName: 'IMG_003.heif',
      mimeType: 'image/heif',
      imageUrl: '/__photo-test/raw/source.heif'
    }
  ]) {
    await page.route('**/api/metadata/image/info/**', (route) =>
      route.fulfill({
        json: {
          ...metadata,
          ...format,
          displayUrl: '/__photo-test/display.jpg',
          width: size.width,
          height: size.height
        }
      })
    )
    await page.goto('/image/heic-test')
    await open(page)
    await expect(page.getByText('高清兼容图已就绪')).toBeVisible()
    await expect(page.getByText('原图暂不可用，仍可浏览预览')).toHaveCount(0)
    await page.getByRole('button', { name: /100%/ }).click()
    await expect(page.locator('.photo-viewer-percent')).toHaveText('100%')
    await expect(
      page.locator('.pswp__img:not(.pswp__img--placeholder)')
    ).toHaveJSProperty('naturalWidth', size.width)
    await page.getByRole('button', { name: '关闭照片浏览' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  }
  expect(rawRequests).toBe(0)
})

test('HEIC compatibility rendition retries from medium preview without falling back to raw', async ({
  page
}) => {
  const jpeg = await sharp(original).jpeg({ quality: 95 }).toBuffer()
  let available = false
  let rawRequests = 0
  await page.route('**/api/metadata/image/info/**', (route) =>
    route.fulfill({
      json: {
        ...metadata,
        fileName: 'IMG_001.HEIC',
        mimeType: 'image/heic',
        imageUrl: '/__photo-test/raw/source.heic',
        displayUrl: '/__photo-test/display.jpg',
        mediumUrl: metadata.displayUrl
      }
    })
  )
  await page.route('**/__photo-test/raw/**', (route) => {
    rawRequests++
    return route.fulfill({ status: 415, body: 'Unsupported' })
  })
  await page.route('**/__photo-test/display.jpg', (route) =>
    available
      ? route.fulfill({ contentType: 'image/jpeg', body: jpeg })
      : route.fulfill({ status: 503, body: 'Unavailable' })
  )
  await page.goto('/image/heic-test')
  await open(page)
  await expect(page.getByText('高清兼容图暂不可用，仍可浏览预览')).toBeVisible()
  await expect(page.getByRole('button', { name: /100%/ })).toBeDisabled()
  available = true
  await page.getByRole('button', { name: '重新加载', exact: true }).click()
  await expect(page.getByText('高清兼容图已就绪')).toBeVisible()
  await page.getByRole('button', { name: /100%/ }).click()
  await expect(page.locator('.photo-viewer-percent')).toHaveText('100%')
  await expect(
    page.locator('.pswp__img:not(.pswp__img--placeholder)')
  ).toHaveJSProperty('naturalWidth', dimensions.width)
  expect(rawRequests).toBe(0)
})

test('photo is the entrance; zoom, original size, information, focus and scroll restoration', async ({
  page
}, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await setup(page)
  await expect(page.getByText('查看原图')).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('detail.png') })
  await page.evaluate(() => window.scrollTo(0, 100))
  const scrollY = await page.evaluate(() => window.scrollY)
  await open(page)
  await expect(page.getByText('原图已就绪')).toBeVisible()
  await expect(page.locator('#app')).toHaveJSProperty('inert', true)
  const initial = await zoomPercent(page)
  await page.getByRole('button', { name: '放大照片', exact: true }).click()
  await expect.poll(() => zoomPercent(page)).toBeGreaterThan(initial)
  await page.getByRole('button', { name: /100%/ }).click()
  await expect(page.locator('.photo-viewer-percent')).toHaveText('100%')
  await page.getByRole('button', { name: '适应屏幕', exact: true }).click()
  await expect.poll(() => zoomPercent(page)).toBe(initial)
  await page.screenshot({ path: testInfo.outputPath('viewer.png') })
  await page.getByRole('button', { name: '照片信息', exact: true }).click()
  await expect(
    page.getByRole('complementary', { name: '照片信息与操作说明' })
  ).toBeVisible()
  await expect(
    page.getByText('snow-mountain.webp', { exact: true }).last()
  ).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('information.png') })
  await page.keyboard.press('Escape')
  await expect(page.locator('#photo-viewer-info')).toHaveCount(0)
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('#app')).toHaveJSProperty('inert', false)
  await expect(
    page.getByRole('button', { name: '详细浏览照片：雪线之上' })
  ).toBeFocused()
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollY)
  expect(errors).toEqual([])
})

test.describe('touch gestures', () => {
  test.skip(({ isMobile }) => !isMobile, 'Touch device coverage')
  test('mobile pinch, double tap, tool visibility and swipe down to close', async ({
    page
  }) => {
    await setup(page)
    await open(page)
    await expect(page.getByText('原图已就绪')).toBeVisible()
    const session = await page.context().newCDPSession(page)
    const touch = (
      type: 'touchStart' | 'touchMove' | 'touchEnd',
      points: Array<{ x: number; y: number; id: number }>
    ) => session.send('Input.dispatchTouchEvent', { type, touchPoints: points })
    const before = await zoomPercent(page)
    await touch('touchStart', [
      { x: 155, y: 385, id: 0 },
      { x: 235, y: 385, id: 1 }
    ])
    for (let i = 1; i <= 8; i++) {
      await touch('touchMove', [
        { x: 155 - i * 9, y: 385, id: 0 },
        { x: 235 + i * 9, y: 385, id: 1 }
      ])
      await page.waitForTimeout(20)
    }
    await touch('touchEnd', [])
    await expect.poll(() => zoomPercent(page)).toBeGreaterThan(before)
    await page.getByRole('button', { name: '适应屏幕', exact: true }).tap()
    await page.waitForTimeout(350)
    await page.touchscreen.tap(195, 385)
    await page.waitForTimeout(400)
    await expect(page.getByRole('button', { name: '显示工具栏' })).toBeVisible()
    await page.getByRole('button', { name: '显示工具栏' }).tap()
    await page.touchscreen.tap(195, 385)
    await page.waitForTimeout(80)
    await page.touchscreen.tap(195, 385)
    await expect.poll(() => zoomPercent(page)).toBeGreaterThan(before)
    await page.getByRole('button', { name: '适应屏幕', exact: true }).tap()
    await page.waitForTimeout(350)
    await touch('touchStart', [{ x: 195, y: 385, id: 0 }])
    for (let i = 1; i <= 12; i++) {
      await touch('touchMove', [{ x: 195, y: 385 + i * 22, id: 0 }])
      await page.waitForTimeout(16)
    }
    await touch('touchEnd', [])
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.locator('#app')).toHaveJSProperty('inert', false)
  })
})

test('browser back during opening removes overlay and restores page interaction', async ({
  page
}) => {
  await setup(page)
  await page.goto('/timeline')
  await page
    .getByRole('link', { name: '查看图片详情', exact: true })
    .first()
    .click()
  await page.getByRole('button', { name: '详细浏览照片：雪线之上' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.goBack()
  await expect(page).toHaveURL(/\/timeline$/)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('#app')).toHaveJSProperty('inert', false)
  expect(
    await page.evaluate(() => document.documentElement.style.overflow)
  ).toBe('')
})

test('scrolling the information sheet never zooms the photo', async ({
  page
}) => {
  await setup(page)
  await page.setViewportSize({ width: 1000, height: 480 })
  await open(page)
  await expect(page.getByText('原图已就绪')).toBeAttached()
  const zoom = await zoomPercent(page)
  await page.getByRole('button', { name: '照片信息', exact: true }).click()
  const panel = page.locator('#photo-viewer-info')
  await panel.hover()
  await page.mouse.wheel(0, 400)
  await expect
    .poll(() => panel.evaluate((el) => el.scrollTop))
    .toBeGreaterThan(0)
  expect(await zoomPercent(page)).toBe(zoom)
})

test('original timeout leaves an actionable preview', async ({ page }) => {
  await setup(page)
  await page.route('**/__photo-test/original.webp', () => {
    /* Deliberately stalled server. */
  })
  await page.clock.install()
  await open(page)
  await expect(page.getByText('正在载入原图')).toBeVisible()
  await page.clock.fastForward(26000)
  await expect(page.getByText('原图暂不可用，仍可浏览预览')).toBeVisible()
  await expect(
    page.getByRole('button', { name: '重新加载', exact: true })
  ).toBeVisible()
  await expect(
    page.locator('.pswp__img:not(.pswp__img--placeholder)')
  ).toBeVisible()
  await page.getByRole('button', { name: '关闭照片浏览' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('portrait photo, narrow viewport and landscape keep controls within screen', async ({
  page
}, testInfo) => {
  const portrait = await sharp(photograph)
    .resize(800, 1200, { fit: 'cover' })
    .webp()
    .toBuffer()
  await setup(page)
  await page.route('**/api/metadata/image/info/**', (route) =>
    route.fulfill({
      json: {
        ...metadata,
        imageUrl: '/__photo-test/portrait.webp',
        displayUrl: '/__photo-test/portrait.webp',
        width: 800,
        height: 1200
      }
    })
  )
  await page.route('**/__photo-test/portrait.webp', (route) =>
    route.fulfill({ contentType: 'image/webp', body: portrait })
  )
  await page.reload()
  await open(page)
  await expect(page.getByText('原图已就绪')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('portrait.png') })
  for (const size of [
    { width: 320, height: 640 },
    { width: 844, height: 390 }
  ]) {
    await page.setViewportSize(size)
    await page.waitForTimeout(300)
    const image = await page
      .locator('.pswp__img:not(.pswp__img--placeholder)')
      .boundingBox()
    const tools = await page.locator('.photo-viewer-tools').boundingBox()
    expect(image!.y).toBeGreaterThanOrEqual(60)
    expect(image!.y + image!.height).toBeLessThanOrEqual(tools!.y + 1)
    expect(tools!.x).toBeGreaterThanOrEqual(0)
    expect(tools!.x + tools!.width).toBeLessThanOrEqual(size.width)
  }
})

test('failed original keeps preview usable and retry succeeds', async ({
  page
}) => {
  await setup(page, { fail: true })
  await open(page)
  await expect(page.getByText('原图暂不可用，仍可浏览预览')).toBeVisible()
  await expect(
    page.locator('.pswp__img:not(.pswp__img--placeholder)')
  ).toBeVisible()
  await expect(page.getByRole('button', { name: /100%/ })).toBeDisabled()
  await page.route('**/__photo-test/original.webp', (route) =>
    route.fulfill({ contentType: 'image/webp', body: original })
  )
  await page.getByRole('button', { name: '重新加载', exact: true }).click()
  await expect(page.getByText('原图已就绪')).toBeVisible()
  await expect(page.getByRole('button', { name: /100%/ })).toBeEnabled()
})

test('slow original can be closed safely and repeated opens stay isolated', async ({
  page
}) => {
  await setup(page, { delay: 1800 })
  for (let i = 0; i < 2; i++) {
    await open(page)
    await expect(page.getByText('正在载入原图')).toBeVisible()
    await page.getByRole('button', { name: '关闭照片浏览' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.locator('#app')).toHaveJSProperty('inert', false)
  }
  await page.waitForTimeout(1900)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('')
})

test('keyboard zoom, tools and focus remain inside viewer', async ({
  page
}) => {
  await setup(page)
  await open(page)
  await expect(page.getByText('原图已就绪')).toBeVisible()
  await page.keyboard.press('1')
  await expect(page.locator('.photo-viewer-percent')).toHaveText('100%')
  await page.keyboard.press('+')
  await expect(page.locator('.photo-viewer-percent')).toHaveText('150%')
  await page.keyboard.press('h')
  await expect(page.getByRole('button', { name: '显示工具栏' })).toBeVisible()
  await expect(page.getByRole('button', { name: '关闭照片浏览' })).toBeVisible()
  await page.keyboard.press('h')
  await expect(
    page.getByRole('button', { name: '放大照片', exact: true })
  ).toBeVisible()
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab')
    expect(
      await page.evaluate(() =>
        Boolean(document.activeElement?.closest('[role="dialog"]'))
      )
    ).toBe(true)
  }
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Shift+Tab')
    expect(
      await page.evaluate(() =>
        Boolean(document.activeElement?.closest('[role="dialog"]'))
      )
    ).toBe(true)
  }
})

test('resolution upgrade preserves the zoomed view even without metadata dimensions', async ({
  page
}) => {
  await setup(page, { delay: 1400, noDimensions: true })
  await open(page)
  await page.getByRole('button', { name: '放大照片', exact: true }).click()
  await page.waitForTimeout(300)
  const before = await page
    .locator('.pswp__img:not(.pswp__img--placeholder)')
    .boundingBox()
  await expect(page.getByText('原图已就绪')).toBeVisible()
  const after = await page
    .locator('.pswp__img:not(.pswp__img--placeholder)')
    .boundingBox()
  expect(before).not.toBeNull()
  expect(after).not.toBeNull()
  expect(Math.abs(after!.width - before!.width)).toBeLessThan(3)
  expect(Math.abs(after!.x - before!.x)).toBeLessThan(3)
  expect(Math.abs(after!.y - before!.y)).toBeLessThan(3)
})

test.describe('mouse gestures', () => {
  test.skip(
    ({ isMobile }) => Boolean(isMobile),
    'Covered by touch gestures instead'
  )
  test('show controls stays centered while pressed and opens on release without moving the mouse', async ({
    page
  }) => {
    await setup(page)
    await open(page)
    await page.getByRole('button', { name: '隐藏工具栏', exact: true }).click()
    const showControls = page.getByRole('button', { name: '显示工具栏' })
    await expect(showControls).toBeVisible()
    await expect(page.locator('.photo-viewer-tools')).not.toBeVisible()
    const before = (await showControls.boundingBox())!
    const centerX = before.x + before.width / 2
    // Use the left half so a rightward jump also breaks the native click.
    await page.mouse.move(
      before.x + before.width / 4,
      before.y + before.height / 2
    )
    await page.mouse.down()
    try {
      // Let the press transition finish before checking the button's position.
      await page.waitForTimeout(200)
      const pressed = (await showControls.boundingBox())!
      expect(Math.abs(pressed.x + pressed.width / 2 - centerX)).toBeLessThan(1)
    } finally {
      await page.mouse.up()
    }
    await expect(showControls).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: '适应屏幕', exact: true })
    ).toBeVisible()
  })
  test('desktop wheel, double click and drag operate on the photograph', async ({
    page
  }) => {
    await setup(page)
    await open(page)
    await expect(page.getByText('原图已就绪')).toBeVisible()
    const before = await zoomPercent(page)
    await page.mouse.move(650, 350)
    await page.mouse.wheel(0, -300)
    await expect.poll(() => zoomPercent(page)).toBeGreaterThan(before)
    await page.keyboard.press('0')
    await page.waitForTimeout(300)
    await page.mouse.dblclick(650, 350)
    await expect.poll(() => zoomPercent(page)).toBeGreaterThan(before)
    await page.waitForTimeout(300)
    const initial = await page
      .locator('.pswp__zoom-wrap')
      .first()
      .getAttribute('style')
    await page.mouse.move(650, 350)
    await page.mouse.down()
    await page.mouse.move(800, 450, { steps: 12 })
    await page.mouse.up()
    await expect
      .poll(() =>
        page.locator('.pswp__zoom-wrap').first().getAttribute('style')
      )
      .not.toBe(initial)
  })
})

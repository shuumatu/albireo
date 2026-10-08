import { drawAlbireoCursor } from './albireoCursorRenderer'
import type { CursorAppearance } from './albireoCursor'

export const CURSOR_SIZE = 32
export const CURSOR_FRAMES = 60
export const CURSOR_FPS = 15
export const animatedCursors = new Set(['hover', 'text', 'working', 'busy', 'move', 'resize'])
export type CursorCrop = { left: number; top: number; right: number; bottom: number }
export function cursorCrop(x: number, y: number): CursorCrop {
  // Chrome rejects bitmap cursors extending beyond the viewport. Clip the
  // artwork at the edge (and move its hotspot), rather than falling back.
  const viewport = window.visualViewport
  const left = viewport?.offsetLeft ?? 0, top = viewport?.offsetTop ?? 0
  const right = left + (viewport?.width ?? innerWidth), bottom = top + (viewport?.height ?? innerHeight)
  const crop = (amount: number) => Math.max(0, Math.min(16, Math.ceil(amount)))
  return { left: crop(left + 16 - x), top: crop(top + 16 - y), right: crop(x + 16 - right), bottom: crop(y + 16 - bottom) }
}

/** Visible, decoded cursor images: the browser moves the actual artwork. */
export function createAlbireoCursorImages() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = CURSOR_SIZE
  const context = canvas.getContext('2d')!
  const cache = new Map<string, Promise<string>>()
  return (appearance: CursorAppearance, frame: number, crop: CursorCrop) => {
    const index = animatedCursors.has(appearance.state) ? frame % CURSOR_FRAMES : 0
    const key = `${appearance.state}:${appearance.rotation}:${index}:${crop.left}:${crop.top}:${crop.right}:${crop.bottom}`
    let result = cache.get(key)
    if (!result) {
      context.clearRect(0, 0, CURSOR_SIZE, CURSOR_SIZE)
      context.save()
      context.translate(CURSOR_SIZE / 2, CURSOR_SIZE / 2)
      context.rotate(appearance.rotation)
      drawAlbireoCursor(context, { x: 0, y: 0, size: CURSOR_SIZE, state: appearance.state, t: index / CURSOR_FPS, phase: index / CURSOR_FRAMES })
      context.restore()
      const clipped = document.createElement('canvas')
      clipped.width = CURSOR_SIZE - crop.left - crop.right
      clipped.height = CURSOR_SIZE - crop.top - crop.bottom
      clipped.getContext('2d')!.drawImage(canvas, -crop.left, -crop.top)
      const url = clipped.toDataURL('image/png')
      const image = new Image()
      image.src = url
      result = image.decode().then(() => `url("${url}") ${16 - crop.left} ${16 - crop.top}, none`)
      if (cache.size >= 512) cache.delete(cache.keys().next().value!)
      cache.set(key, result)
    }
    return result
  }
}

<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import defaultCursor from '../assets/cursor-default.png'
import { resolveAlbireoCursor, type CursorAppearance } from '../utils/albireoCursor'
import { createCursorStyleMirror } from '../utils/albireoCursorStyles'
import { animatedCursors, createAlbireoCursorImages, cursorCrop, CURSOR_FPS } from '../utils/albireoCursorImages'
import { createAlbireoScrollbars } from '../utils/albireoScrollbars'

const route = useRoute()
const MASK = 'data-albireo-cursor-active'
let mounted = false, enabled = false, inside = false, touch = false
let x = 0, y = 0, frame = 0, lastPaint = 0, animationFrame = 0
let target: Element | null = null, captured: Element | null = null
let appearance: CursorAppearance = { state: 'default', rotation: 0 }
let drag: CursorAppearance | null = null
let requested = ''
let edge = ''
let dirty = true
let fine: MediaQueryList, reduced: MediaQueryList, forced: MediaQueryList
let observer: MutationObserver
let styles: ReturnType<typeof createCursorStyleMirror>
let images: ReturnType<typeof createAlbireoCursorImages>
let scrollbars: ReturnType<typeof createAlbireoScrollbars> | undefined
let sheet: HTMLStyleElement, imageRule: CSSStyleRule
const cleanup: (() => void)[] = []

function listen(host: EventTarget, name: string, handler: EventListener, passive = true) {
  host.addEventListener(name, handler, { capture: true, passive })
  cleanup.push(() => host.removeEventListener(name, handler, true))
}

function setImage(value: string) {
  // CSSOM writes avoid observing our own style mutations on <html>.
  imageRule.style.setProperty('--albireo-cursor-image', value)
}

function paint(now: number, force = false) {
  if (!enabled || (!force && now - lastPaint < 1000 / CURSOR_FPS)) return
  lastPaint = now
  const snapshot = { ...appearance }
  const index = reduced.matches ? 0 : animationFrame++
  const crop = cursorCrop(x, y)
  edge = JSON.stringify(crop)
  const key = `${snapshot.state}:${snapshot.rotation}:${index}:${edge}`
  requested = key
  void images(snapshot, index, crop).then(value => {
    // A stale decode cannot restore an earlier state or change an unmounted page.
    if (!mounted || !enabled || requested !== key) return
    setImage(value)
    document.documentElement.dataset.albireoCursorState = snapshot.state
    document.documentElement.dataset.albireoCursorMotion = reduced.matches ? 'reduced' : 'animated'
  }).catch(() => { /* Keep decoded artwork if a frame fails. */ })
}

function sample() {
  const element = captured?.isConnected ? captured : document.elementFromPoint(x, y)
  if (!element) return
  observer.disconnect()
  const source = styles.read(element)
  const next = drag ?? resolveAlbireoCursor(element, source)
  target = element
  for (let node: Element | null = element; node; node = node.parentElement) {
    observer.observe(node, { attributes: true, attributeFilter: ['class', 'style', 'disabled', 'aria-disabled', 'aria-busy', 'data-albireo-cursor', 'type', 'contenteditable'] })
  }
  if (!next) {
    requested = ''
    setImage(element.closest('[data-albireo-cursor="native"]') ? source : 'none')
    document.documentElement.dataset.albireoCursorState = 'hidden'
    return
  }
  if (next.state !== appearance.state || next.rotation !== appearance.rotation) animationFrame = 0
  appearance = next
  paint(performance.now(), true)
}

function tick(now: number) {
  frame = 0
  if (!enabled || !inside || document.hidden) return
  if (dirty) { dirty = false; sample() }
  else if (!reduced.matches && requested && animatedCursors.has(appearance.state)) paint(now)
  if (!reduced.matches && requested && animatedCursors.has(appearance.state)) frame = requestAnimationFrame(tick)
}

function schedule() {
  dirty = true
  if (mounted && enabled && inside && !frame) frame = requestAnimationFrame(tick)
}

function refreshEnabled() {
  const next = mounted && fine.matches && !forced.matches && !touch && !document.pointerLockElement
  if (next === enabled) { schedule(); return }
  enabled = next
  if (enabled) {
    // Install artwork for the whole mouse session, including focus changes,
    // mouse down/up, routing and pointer cancellation.
    document.documentElement.setAttribute(MASK, '')
    scrollbars = createAlbireoScrollbars()
    schedule()
  } else {
    document.documentElement.removeAttribute(MASK)
    document.documentElement.removeAttribute('data-albireo-cursor-state')
    observer?.disconnect()
    scrollbars?.dispose(); scrollbars = undefined
    cancelAnimationFrame(frame); frame = 0
    requested = ''
  }
}

function pointer(event: Event) {
  const e = event as PointerEvent
  const nextTouch = e.pointerType !== 'mouse'
  if (nextTouch !== touch) { touch = nextTouch; refreshEnabled() }
  if (!enabled) return
  inside = true
  x = e.clientX; y = e.clientY
  if (!(e.buttons & 1)) drag = null
  const element = captured?.isConnected ? captured : document.elementFromPoint(x, y)
  if (dirty || element !== target || e.type !== 'pointermove' || edge !== JSON.stringify(cursorCrop(x, y))) {
    dirty = false
    sample()
  }
  if (e.type === 'pointerdown' && e.button === 0 && ['text', 'move', 'resize'].includes(appearance.state)) drag = { ...appearance }
  if (!frame && !reduced.matches && animatedCursors.has(appearance.state)) frame = requestAnimationFrame(tick)
}

function stopInteraction() {
  inside = false; drag = null; captured = null
  observer.disconnect()
  cancelAnimationFrame(frame); frame = 0
  // Do not remove CSS cursors on blur or pointercancel. A browser cursor follows
  // the real pointer, so there is no overlay to leave behind.
}

watch(() => route.fullPath, schedule, { flush: 'post' })
onMounted(() => {
  mounted = true
  fine = matchMedia('(any-hover: hover) and (any-pointer: fine)')
  reduced = matchMedia('(prefers-reduced-motion: reduce)')
  forced = matchMedia('(forced-colors: active)')
  images = createAlbireoCursorImages()
  sheet = document.createElement('style')
  sheet.dataset.albireoCursorRuntime = ''
  sheet.textContent = `:root { --albireo-cursor-image: url("${defaultCursor}") 16 16, none; }`
  document.head.append(sheet)
  imageRule = sheet.sheet!.cssRules[0] as CSSStyleRule
  observer = new MutationObserver(schedule)
  styles = createCursorStyleMirror(schedule)
  for (const media of [fine, reduced, forced]) listen(media, 'change', refreshEnabled)
  for (const name of ['pointerover', 'pointermove', 'pointerdown', 'pointerup']) listen(document, name, pointer)
  listen(document, 'pointerout', event => { if (!(event as PointerEvent).relatedTarget) stopInteraction() })
  listen(document, 'pointercancel', () => { drag = null; captured = null; schedule() })
  listen(window, 'blur', stopInteraction)
  listen(window, 'focus', schedule)
  listen(document, 'visibilitychange', () => { if (document.hidden) stopInteraction() })
  listen(document, 'scroll', schedule)
  listen(window, 'resize', schedule)
  listen(document, 'pointerlockchange', refreshEnabled)
  listen(document, 'fullscreenchange', () => { scrollbars?.refresh(); schedule() })
  listen(document, 'gotpointercapture', e => { captured = e.target instanceof Element ? e.target : null; schedule() })
  listen(document, 'lostpointercapture', () => { captured = null; schedule() })
  listen(window, 'mouseup', () => { drag = null; captured = null; schedule() })
  // Implicit image/link dragging switches to the OS drag-and-drop cursor.
  // Browsing controls keep clicks/selection; explicitly draggable widgets retain DnD.
  listen(document, 'dragstart', e => {
    if (enabled && e.target instanceof Element && e.target.closest('img,a[href]') && !e.target.closest('[draggable="true"]')) e.preventDefault()
  }, false)
  refreshEnabled()
})

onUnmounted(() => {
  mounted = false
  refreshEnabled()
  cleanup.forEach(remove => remove())
  styles?.dispose()
  sheet?.remove()
  document.documentElement.removeAttribute('data-albireo-cursor-motion')
})
</script>

<template><!-- The browser renders the cursor. No second pointer layer. --></template>

<style>
@layer albireo-cursor-mask {
  :root[data-albireo-cursor-active],
  :root[data-albireo-cursor-active] *,
  :root[data-albireo-cursor-active] *::before,
  :root[data-albireo-cursor-active] *::after {
    cursor: var(--albireo-cursor-image, url('../assets/cursor-default.png') 16 16, none) !important;
  }
  :root[data-albireo-cursor-active] input::-webkit-slider-thumb,
  :root[data-albireo-cursor-active] input::-webkit-calendar-picker-indicator,
  :root[data-albireo-cursor-active] input::-webkit-inner-spin-button,
  :root[data-albireo-cursor-active] input::file-selector-button {
    cursor: var(--albireo-cursor-image) !important;
  }
  :root[data-albireo-cursor-active] input::-moz-range-thumb { cursor: var(--albireo-cursor-image) !important; }
}
</style>

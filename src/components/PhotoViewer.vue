<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, shallowRef } from 'vue'
import type PhotoSwipe from 'photoswipe'
import type { SlideData } from 'photoswipe'
import dayjs from 'dayjs'
import type { ImageInfoVO } from '../api/image'
import {
  decodePhoto,
  fullSizePhotoSource,
  formatImageSize,
  upgradedZoom
} from '../utils/photoViewer'
import 'photoswipe/style.css'
import '../styles/photo-viewer.css'

const props = defineProps<{ image: ImageInfoVO; title: string }>()
const emit = defineEmits<{ error: [] }>()
const uiRoot = shallowRef<HTMLElement>()
const closeButton = ref<HTMLButtonElement>()
const infoButton = ref<HTMLButtonElement>()
const panelClose = ref<HTMLButtonElement>()
const controls = ref(true)
const info = ref(false)
const closing = ref(false)
const quality = ref<
  'preview' | 'loading' | 'original' | 'compatible' | 'error'
>('preview')
const fullSizeSource = computed(() => fullSizePhotoSource(props.image))
const fullSizeReady = computed(
  () => quality.value === 'original' || quality.value === 'compatible'
)
const zoom = ref(1)
const minZoom = ref(1)
const maxZoom = ref(4)
const width = ref(0)
const height = ref(0)
const ready = ref(false)
const opening = ref(false)
const fileSize = computed(() => formatImageSize(props.image.fileSize))
const shotAt = computed(() =>
  props.image.shotAt ? dayjs(props.image.shotAt).format('YYYY-MM-DD HH:mm') : ''
)
const percent = computed(() => Math.round(zoom.value * 100))
const isFit = computed(() => Math.abs(zoom.value - minZoom.value) < 0.001)
const qualityText = computed(
  () =>
    ({
      preview: '预览画面',
      loading:
        fullSizeSource.value.kind === 'compatible'
          ? '正在载入高清兼容图'
          : '正在载入原图',
      original: '原图已就绪',
      compatible: '高清兼容图已就绪',
      error:
        fullSizeSource.value.kind === 'compatible'
          ? '高清兼容图暂不可用，仍可浏览预览'
          : '原图暂不可用，仍可浏览预览'
    })[quality.value]
)
let viewer: PhotoSwipe | undefined
let source: SlideData | undefined
let trigger: HTMLButtonElement | undefined
let request: AbortController | undefined
let restorePage: (() => void) | undefined
let disposed = false
let reducedMotion = false
let doubleClick: ((event: MouseEvent) => void) | undefined
let originalReady: HTMLImageElement | undefined
let upgrading = false
let dragging = false
const activePointers = new Set<number>()
let upgradeTimer: number | undefined
let pendingClose = false

function syncZoom() {
  const slide = viewer?.currSlide
  if (!slide) return
  // Until full resolution arrives, show the scale relative to known original pixels.
  const ratio =
    props.image.width && !fullSizeReady.value
      ? slide.width / props.image.width
      : 1
  zoom.value = slide.currZoomLevel * ratio
  minZoom.value = slide.zoomLevels.initial * ratio
  maxZoom.value = slide.zoomLevels.max * ratio
}

function zoomTo(value: number) {
  const slide = viewer?.currSlide
  if (!slide || !ready.value) return
  const ratio =
    props.image.width && !fullSizeReady.value
      ? slide.width / props.image.width
      : 1
  slide.zoomTo(value / ratio, undefined, reducedMotion ? 0 : 240)
}
function fit() {
  zoomTo(minZoom.value)
}
function toggleControls() {
  if (info.value) return
  controls.value = !controls.value
  if (!controls.value) closeButton.value?.focus({ preventScroll: true })
}
async function toggleInfo() {
  info.value = !info.value
  controls.value = true
  await nextTick()
  ;(info.value ? panelClose.value : infoButton.value)?.focus({
    preventScroll: true
  })
}
function close() {
  if (!ready.value) pendingClose = true
  else viewer?.close()
}
function destroyImmediately() {
  if (!viewer) return
  // PhotoSwipe.close() ignores requests during the opening animation.
  // Route teardown must still synchronously remove the overlay and all listeners.
  viewer.animations.stopAll()
  viewer.isDestroying = true
  viewer.destroy()
}

function lockPage() {
  const body = document.body
  const root = document.documentElement
  const app = document.getElementById('app')
  const previous = {
    body: body.style.overflow,
    root: root.style.overflow,
    padding: body.style.paddingRight,
    inert: app?.inert
  }
  const scrollbar = window.innerWidth - root.clientWidth
  if (scrollbar > 0)
    body.style.paddingRight = `${parseFloat(getComputedStyle(body).paddingRight) + scrollbar}px`
  body.style.overflow = 'hidden'
  root.style.overflow = 'hidden'
  // Move focus before making its previous ancestor inert.
  viewer?.element?.focus({ preventScroll: true })
  if (app) app.inert = true
  restorePage = () => {
    body.style.overflow = previous.body
    root.style.overflow = previous.root
    body.style.paddingRight = previous.padding
    if (app) app.inert = previous.inert ?? false
    restorePage = undefined
  }
}

function release() {
  request?.abort()
  request = undefined
  window.clearTimeout(upgradeTimer)
  originalReady = undefined
  if (doubleClick)
    viewer?.scrollWrap?.removeEventListener('dblclick', doubleClick)
  doubleClick = undefined
  restorePage?.()
  uiRoot.value = undefined
  viewer = undefined
  source = undefined
  opening.value = false
  ready.value = false
  if (!disposed && trigger?.isConnected) trigger.focus({ preventScroll: true })
}

function upgradeOriginal() {
  if (!viewer || !source || !originalReady || closing.value) return
  // Never interrupt a pinch, a drag, or a running zoom animation.
  if (!ready.value || dragging || viewer.animations.activeAnimations.length) {
    upgradeTimer = window.setTimeout(upgradeOriginal, 100)
    return
  }
  const old = viewer.currSlide
  const targetZoom = old
    ? upgradedZoom(old.currZoomLevel, old.width, originalReady.naturalWidth)
    : undefined
  const oldPan = old ? { ...old.pan } : undefined
  const wasFit =
    !old || Math.abs(old.currZoomLevel - old.zoomLevels.initial) < 0.001
  width.value = originalReady.naturalWidth
  height.value = originalReady.naturalHeight
  Object.assign(source, {
    src: fullSizeSource.value.url,
    width: width.value,
    height: height.value
  })
  originalReady = undefined
  quality.value = fullSizeSource.value.kind
  upgrading = true
  viewer.refreshSlideContent(0)
  const slide = viewer.currSlide
  if (slide && !wasFit && targetZoom && oldPan) {
    slide.zoomTo(targetZoom, undefined, 0)
    slide.panTo(oldPan.x, oldPan.y)
  }
  upgrading = false
  syncZoom()
}

async function loadOriginal() {
  if (!viewer || !fullSizeSource.value.url || quality.value === 'loading')
    return
  request?.abort()
  const controller = new AbortController()
  request = controller
  quality.value = 'loading'
  try {
    const image = await decodePhoto(fullSizeSource.value.url, controller.signal)
    if (controller.signal.aborted || !viewer || closing.value) return
    originalReady = image
    upgradeOriginal()
  } catch {
    if (!controller.signal.aborted && viewer && !closing.value)
      quality.value = 'error'
  }
}

function keydown(event: KeyboardEvent): boolean {
  if (event.altKey || event.ctrlKey || event.metaKey) return false
  if (event.key === 'Tab' && uiRoot.value) {
    const buttons = Array.from(
      uiRoot.value.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')
    ).filter(
      (button) =>
        button.getClientRects().length &&
        getComputedStyle(button).visibility !== 'hidden'
    )
    const first = buttons[0],
      last = buttons[buttons.length - 1]
    if (
      event.shiftKey &&
      (document.activeElement === first ||
        document.activeElement === uiRoot.value)
    )
      last?.focus()
    else if (
      !event.shiftKey &&
      (document.activeElement === last ||
        document.activeElement === uiRoot.value)
    )
      first?.focus()
    else return false
    return true
  }
  if (event.key === 'Escape' && info.value) {
    void toggleInfo()
    return true
  }
  switch (event.key.toLowerCase()) {
    case '+':
    case '=':
      zoomTo(zoom.value * 1.5)
      return true
    case '-':
    case '_':
      zoomTo(zoom.value / 1.5)
      return true
    case '0':
      fit()
      return true
    case '1':
      if (fullSizeReady.value) zoomTo(1)
      return true
    case 'i':
      void toggleInfo()
      return true
    case 'h':
      toggleControls()
      return true
    default:
      return false
  }
}

async function open(button: HTMLButtonElement, thumbnail: HTMLImageElement) {
  if (opening.value || viewer || !thumbnail.naturalWidth) return
  opening.value = true
  trigger = button
  try {
    const { default: PhotoSwipe } = await import('photoswipe')
    if (disposed || !button.isConnected) return
    reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches
    controls.value = true
    info.value = false
    closing.value = false
    dragging = false
    activePointers.clear()
    pendingClose = false
    width.value = props.image.width || thumbnail.naturalWidth
    height.value = props.image.height || thumbnail.naturalHeight
    const previewSrc = thumbnail.currentSrc || thumbnail.src
    const isFullSize =
      new URL(fullSizeSource.value.url || previewSrc, location.href).href ===
      previewSrc
    quality.value = isFullSize ? fullSizeSource.value.kind : 'preview'
    if (isFullSize) {
      width.value = thumbnail.naturalWidth
      height.value = thumbnail.naturalHeight
    }
    source = {
      src: previewSrc,
      msrc: previewSrc,
      width: thumbnail.naturalWidth,
      height: thumbnail.naturalHeight,
      alt: props.title,
      element: button
    }
    const instance = new PhotoSwipe({
      dataSource: [source],
      mainClass: 'albireo-viewer',
      bgOpacity: 1,
      showHideAnimationType: reducedMotion ? 'none' : 'zoom',
      showAnimationDuration: 360,
      hideAnimationDuration: 280,
      zoomAnimationDuration: reducedMotion ? 0 : 240,
      easing: 'cubic-bezier(.22,1,.36,1)',
      wheelToZoom: true,
      pinchToClose: false,
      closeOnVerticalDrag: true,
      initialZoomLevel: (level) => Math.min(1, level.fit),
      secondaryZoomLevel: (level) => Math.max(1, level.initial * 2),
      maxZoomLevel: (level) => Math.max(4, level.initial * 4),
      paddingFn: (viewport) => ({
        top: viewport.y < 500 ? 64 : viewport.x < 640 ? 80 : 100,
        bottom: viewport.y < 500 ? 76 : 160,
        left: viewport.x < 640 ? 12 : 56,
        right: viewport.x < 640 ? 12 : 56
      }),
      imageClickAction: false,
      bgClickAction: 'close',
      tapAction: toggleControls,
      doubleTapAction: 'zoom',
      close: false,
      zoom: false,
      counter: false,
      arrowPrev: false,
      arrowNext: false,
      returnFocus: false,
      trapFocus: true,
      errorMsg: '画面暂时无法加载，请关闭后重试'
    })
    viewer = instance
    // object-fit: contain can leave empty space inside the <img> box.
    // Animate from the actual photograph, not that surrounding space.
    instance.addFilter('thumbBounds', () => {
      const rect = thumbnail.getBoundingClientRect()
      const scale = Math.min(
        rect.width / thumbnail.naturalWidth,
        rect.height / thumbnail.naturalHeight
      )
      const w = thumbnail.naturalWidth * scale
      const h = thumbnail.naturalHeight * scale
      return {
        x: rect.left + (rect.width - w) / 2,
        y: rect.top + (rect.height - h) / 2,
        w
      }
    })
    instance.on('afterInit', () => {
      uiRoot.value = instance.element
      instance.element?.setAttribute('aria-label', `${props.title} · 照片浏览`)
      lockPage()
      doubleClick = (event) => {
        if (info.value || !ready.value) return
        event.preventDefault()
        instance.currSlide?.toggleZoom({ x: event.clientX, y: event.clientY })
      }
      instance.scrollWrap?.addEventListener('dblclick', doubleClick)
      syncZoom()
    })
    instance.on('openingAnimationEnd', () => {
      ready.value = true
      opening.value = false
      if (pendingClose) {
        close()
        return
      }
      void nextTick(() => closeButton.value?.focus({ preventScroll: true }))
      if (!isFullSize) void loadOriginal()
    })
    instance.on('zoomPanUpdate', syncZoom)
    instance.on('pointerDown', ({ originalEvent }) => {
      activePointers.add(originalEvent.pointerId)
      dragging = true
    })
    instance.on('pointerUp', ({ originalEvent }) => {
      activePointers.delete(originalEvent.pointerId)
      dragging = activePointers.size > 0
    })
    instance.on('keydown', (event) => {
      if (info.value && event.originalEvent.key.startsWith('Arrow')) {
        event.preventDefault() // Keep native sheet scrolling; stop PhotoSwipe panning.
        return
      }
      if (keydown(event.originalEvent)) {
        event.preventDefault()
        event.originalEvent.preventDefault()
      }
    })
    instance.on('close', () => {
      closing.value = true
      request?.abort()
    })
    instance.on('destroy', release)
    instance.on('loadComplete', ({ isError }) => {
      if (isError && !upgrading) quality.value = 'error'
    })
    instance.init()
  } catch {
    destroyImmediately()
    release()
    emit('error')
  } finally {
    if (!viewer) opening.value = false
  }
}

onBeforeUnmount(() => {
  disposed = true
  destroyImmediately()
  release()
})
defineExpose({ open, opening })
</script>

<template>
  <Teleport v-if="uiRoot" :to="uiRoot">
    <div
      class="photo-viewer-ui"
      :class="{ 'is-quiet': !controls, 'is-closing': closing }"
      @wheel.stop
    >
      <header class="photo-viewer-header">
        <div class="photo-viewer-heading viewer-chrome">
          <span class="photo-viewer-eyebrow"
            >ALBIREO <span>/</span> PHOTO VIEWER</span
          >
          <h2>{{ title }}</h2>
        </div>
        <div class="photo-viewer-header-actions">
          <button
            class="viewer-icon-button viewer-chrome quiet-toggle"
            type="button"
            title="隐藏工具栏 (H)"
            aria-label="隐藏工具栏"
            @click="toggleControls"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 8V4h4m10 0h4v4M3 16v4h4m10 0h4v-4M8 12h8" />
            </svg>
          </button>
          <button
            ref="infoButton"
            class="viewer-icon-button viewer-chrome"
            type="button"
            title="照片信息 (I)"
            aria-label="照片信息"
            :aria-expanded="info"
            aria-controls="photo-viewer-info"
            @click="toggleInfo"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 11v6m0-10v1" />
            </svg>
          </button>
          <button
            ref="closeButton"
            class="viewer-icon-button viewer-close"
            type="button"
            title="关闭 (Esc)"
            aria-label="关闭照片浏览"
            @click="close"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
      </header>

      <button
        v-if="!controls"
        class="viewer-show-controls"
        type="button"
        @click="toggleControls"
      >
        显示工具栏 <span>H</span>
      </button>

      <footer class="photo-viewer-footer viewer-chrome">
        <div
          class="photo-viewer-status"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <span
            class="viewer-status-dot"
            :class="quality"
            aria-hidden="true"
          ></span>
          <span>{{ qualityText }}</span>
          <button
            v-if="quality === 'error'"
            type="button"
            class="viewer-retry"
            @click="loadOriginal"
          >
            重新加载
          </button>
          <span v-else class="viewer-dimensions"
            >{{ width }} × {{ height }}</span
          >
        </div>
        <div class="photo-viewer-tools" role="group" aria-label="照片缩放工具">
          <button
            type="button"
            class="viewer-icon-button"
            :disabled="!ready || isFit"
            title="缩小 (-)"
            aria-label="缩小照片"
            @click="zoomTo(zoom / 1.5)"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12h14" />
            </svg>
          </button>
          <output class="photo-viewer-percent" aria-label="当前缩放比例"
            >{{ percent }}<small>%</small></output
          >
          <button
            type="button"
            class="viewer-icon-button"
            :disabled="!ready || zoom >= maxZoom - 0.001"
            title="放大 (+)"
            aria-label="放大照片"
            @click="zoomTo(zoom * 1.5)"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12h14M12 5v14" />
            </svg>
          </button>
          <span class="viewer-divider" aria-hidden="true"></span>
          <button
            type="button"
            class="viewer-text-button"
            :aria-pressed="isFit"
            :disabled="!ready"
            title="适应屏幕 (0)"
            @click="fit"
          >
            适应屏幕
          </button>
          <button
            type="button"
            class="viewer-text-button"
            :aria-pressed="Math.abs(zoom - 1) < 0.001"
            :disabled="!ready || !fullSizeReady"
            title="100% 缩放 (1)"
            @click="zoomTo(1)"
          >
            100% <span>缩放</span>
          </button>
        </div>
        <p class="photo-viewer-help desktop-help">
          滚轮缩放 <span>·</span> 双击放大 <span>·</span> 拖动查看细节
          <span>·</span> <kbd>Esc</kbd> 关闭
        </p>
        <p class="photo-viewer-help touch-help">
          双指缩放 <span>·</span> 双击放大 <span>·</span> 下滑关闭
        </p>
      </footer>

      <Transition name="viewer-panel">
        <aside
          v-if="info"
          id="photo-viewer-info"
          class="photo-viewer-info"
          aria-label="照片信息与操作说明"
        >
          <div class="viewer-info-heading">
            <span class="photo-viewer-eyebrow">ABOUT THIS FRAME</span
            ><button
              ref="panelClose"
              class="viewer-icon-button"
              aria-label="收起照片信息"
              type="button"
              @click="toggleInfo"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
          <h3>{{ title }}</h3>
          <p
            v-if="fullSizeSource.kind === 'compatible'"
            class="viewer-description"
          >
            使用全尺寸 JPEG 兼容图浏览，HEIC / HEIF 源文件保持不变。
          </p>
          <p v-if="image.description" class="viewer-description">
            {{ image.description }}
          </p>
          <dl class="viewer-metadata">
            <template v-if="image.shotAt"
              ><dt>拍摄时间</dt>
              <dd>
                {{ shotAt }}
              </dd></template
            >
            <dt>画面尺寸</dt>
            <dd>{{ width }} × {{ height }}</dd>
            <template v-if="fileSize"
              ><dt>文件大小</dt>
              <dd>{{ fileSize }}</dd></template
            >
            <template v-if="image.type"
              ><dt>作品类型</dt>
              <dd>{{ image.type }}</dd></template
            >
            <dt>文件名称</dt>
            <dd>{{ image.fileName }}</dd>
          </dl>
          <div class="viewer-shortcuts">
            <h4>自在浏览</h4>
            <p>放大后拖动画面，探索每一处细节。</p>
            <dl class="viewer-keyboard-shortcuts">
              <dt>放大 / 缩小</dt>
              <dd><kbd>+</kbd> <kbd>−</kbd></dd>
              <dt>适应屏幕 / 100% 缩放</dt>
              <dd><kbd>0</kbd> <kbd>1</kbd></dd>
              <dt>移动放大后的画面</dt>
              <dd><kbd>↑</kbd> <kbd>↓</kbd> <kbd>←</kbd> <kbd>→</kbd></dd>
              <dt>收起 / 展开工具栏</dt>
              <dd><kbd>H</kbd></dd>
              <dt>照片信息</dt>
              <dd><kbd>I</kbd></dd>
              <dt>关闭</dt>
              <dd><kbd>Esc</kbd></dd>
            </dl>
            <dl class="viewer-touch-shortcuts">
              <dt>放大 / 缩小</dt>
              <dd>双指开合</dd>
              <dt>快速放大 / 还原</dt>
              <dd>双击画面</dd>
              <dt>收起 / 展开工具栏</dt>
              <dd>轻点画面</dd>
              <dt>关闭浏览</dt>
              <dd>适应屏幕时下滑</dd>
            </dl>
          </div>
          <p class="viewer-info-note">LIGHT. PLACE. MEMORY.</p>
        </aside>
      </Transition>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, onDeactivated, onActivated, watch } from 'vue'
import {
  edgeVelocity,
  createPanMotion,
  horizontalOverflow
} from '../utils/panorama'
import { useBackgroundSlideshow } from '../composables/useBackgroundSlideshow'
import type { BackgroundSlide, BackgroundPlaybackOptions } from '../types/background'

const props = withDefaults(defineProps<{
  slides: readonly BackgroundSlide[]
  playback?: BackgroundPlaybackOptions
  panEnabled?: boolean
  label?: string
}>(), { panEnabled: true, label: '背景画面' })
const emit = defineEmits<{
  change: [slide: BackgroundSlide | null]
  error: [slide: BackgroundSlide]
}>()
const hero = ref<HTMLElement>()
const imageHost = ref<HTMLElement>()
const pan = ref(50)
const panDirection = ref(0)
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
const slideshow = useBackgroundSlideshow(
  computed(() => props.slides), imageHost, reduced, updatePan,
  computed(() => props.playback), (slide) => emit('error', slide)
)
const { slides, current, active, front, failure, busy } = slideshow
watch(current, (slide) => {
  if (!slide) stopPan()
  emit('change', slide)
})
watch(() => props.panEnabled, () => stopPan())
defineExpose({
  select: (id: string) => select(slides.value.findIndex((slide) => slide.id === id)),
  retry: slideshow.retry
})
let resizeObserver: ResizeObserver | undefined
let resizeTimer: ReturnType<typeof setTimeout> | undefined
let suspended = false
let velocity = 0,
  overflow = 0
let pointer: { x: number; y: number } | null = null
const motion = createPanMotion(
  () => ({ position: pan.value, velocity, overflow }),
  (position) => {
    pan.value = position
  },
  (callback) => requestAnimationFrame(callback),
  (id) => cancelAnimationFrame(id)
)
function stopPan() {
  motion.stop()
  velocity = 0
  panDirection.value = 0
  pointer = null
}
function updatePan() {
  if (!props.panEnabled || !pointer || !hero.value || !front.value) return
  const rect = hero.value.getBoundingClientRect()
  if (
    pointer.x < rect.left ||
    pointer.x > rect.right ||
    pointer.y < rect.top ||
    pointer.y > rect.bottom
  ) {
    stopPan()
    return
  }
  const ratio = (pointer.x - rect.left) / rect.width
  overflow = horizontalOverflow(
    front.value.naturalWidth,
    front.value.naturalHeight,
    rect.width,
    rect.height
  )
  velocity = edgeVelocity(ratio)
  panDirection.value = overflow ? Math.sign(velocity) : 0
  if (!velocity || !overflow) {
    motion.stop()
    return
  }
  if (reduced.matches) {
    motion.stop()
    pan.value = Math.max(0, Math.min(100, ratio * 100))
    return
  }
  motion.start()
}
function movePan(event: PointerEvent) {
  if (!props.panEnabled) return
  if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return
  if ((event.target as Element).closest('button, a, .background-error')) {
    stopPan()
    return
  }
  pointer = { x: event.clientX, y: event.clientY }
  updatePan()
}
function keyPan(event: KeyboardEvent) {
  if (!props.panEnabled) return
  if (event.target !== event.currentTarget) return
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
  event.preventDefault()
  stopPan()
  pan.value = Math.max(
    0,
    Math.min(100, pan.value + (event.key === 'ArrowLeft' ? -5 : 5))
  )
}
function visibilityChanged() {
  if (document.hidden) {
    stopPan()
    slideshow.pause()
  } else if (!suspended) {
    void slideshow.resume()
  }
}
function select(index: number) {
  stopPan()
  void slideshow.select(index)
}
function enter(event: PointerEvent, index: number) {
  if (event.pointerType === 'mouse') {
    stopPan()
    slideshow.hover(index)
  }
}
function resized() {
  stopPan()
  clearTimeout(resizeTimer)
  resizeTimer = setTimeout(() => {
    if (!suspended && !document.hidden) void slideshow.refresh()
  }, 180)
}
onMounted(() => {
  if (document.hidden) slideshow.pause()
  else void slideshow.refresh()
  let { width, height } = hero.value!.getBoundingClientRect()
  resizeObserver = new ResizeObserver(([entry]) => {
    if (!entry) return
    const size = entry.contentRect
    if (size.width === width && size.height === height) return
    width = size.width
    height = size.height
    resized()
  })
  resizeObserver.observe(hero.value!)
  window.addEventListener('blur', stopPan)
  window.addEventListener('resize', resized)
  document.addEventListener('visibilitychange', visibilityChanged)
})
onDeactivated(() => {
  suspended = true
  stopPan()
  slideshow.pause()
  clearTimeout(resizeTimer)
})
onActivated(() => {
  suspended = false
  if (!document.hidden) void slideshow.resume()
})
onBeforeUnmount(() => {
  stopPan()
  slideshow.stop()
  resizeObserver?.disconnect()
  clearTimeout(resizeTimer)
  window.removeEventListener('blur', stopPan)
  window.removeEventListener('resize', resized)
  document.removeEventListener('visibilitychange', visibilityChanged)
})
</script>
<template>
  <div
    ref="hero"
    class="background-slideshow"
    :aria-busy="busy"
    :style="{ '--background-pan': `${pan}%` }"
    :tabindex="panEnabled ? 0 : undefined"
    :aria-label="panEnabled ? `${label}，鼠标移至左右边缘平移，也可使用左右方向键` : label"
    @pointermove="movePan"
    @pointerenter="movePan"
    @pointerleave="stopPan"
    @pointercancel="stopPan"
    @keydown="keyPan"
  >
    <div ref="imageHost" class="background-images"></div>
    <div
      v-if="panEnabled"
      class="pan-cue pan-cue-left"
      :class="{ 'is-visible': panDirection === -1, 'at-limit': pan <= 0 }"
      aria-hidden="true"
    >
      <svg viewBox="0 0 32 32" fill="none">
        <path d="m20 6-10 10 10 10" />
      </svg>
    </div>
    <div
      v-if="panEnabled"
      class="pan-cue pan-cue-right"
      :class="{ 'is-visible': panDirection === 1, 'at-limit': pan >= 100 }"
      aria-hidden="true"
    >
      <svg viewBox="0 0 32 32" fill="none">
        <path d="m12 6 10 10-10 10" />
      </svg>
    </div>
    <slot
      :slides="slides" :current="current" :active="active" :busy="busy"
      :failure="failure" :select="select" :hover="enter"
      :cancel-hover="slideshow.cancelHover" :retry="slideshow.retry"
    />
    <slot v-if="!slides.length" name="empty" />
    <div v-if="failure" class="background-error" role="status">
      <slot name="error" :retry="slideshow.retry">
        画面暂时无法加载
        <button @click="slideshow.retry">重试</button>
      </slot>
    </div>
  </div>
</template>
<style scoped>
.background-slideshow {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  background: #111a22;
}
.background-images {
  position: absolute;
  inset: 0;
  z-index: -3;
  pointer-events: none;
}
.background-images :deep(.background-image) {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: var(--background-pan, 50%) center;
  user-select: none;
}
.background-images :deep(.background-image.is-current) {
  z-index: 1;
}
.pan-cue {
  position: absolute;
  top: 50%;
  z-index: 1;
  display: grid;
  color: #d9e9ff;
  opacity: 0;
  transform: translateY(-50%);
  transition: opacity 160ms ease;
  filter: drop-shadow(0 1px 3px #0009);
  pointer-events: none;
}
.pan-cue-left {
  left: clamp(18px, 3vw, 52px);
}
.pan-cue-right {
  right: clamp(18px, 3vw, 52px);
}
.pan-cue.is-visible {
  opacity: 0.85;
}
.pan-cue svg {
  width: 32px;
  height: 32px;
  stroke: currentColor;
  stroke-width: 1.5;
}
.pan-cue.is-visible.at-limit {
  opacity: 0.3;
}
@media (prefers-reduced-motion: reduce) {
  .pan-cue {
    transition: none;
  }
}
.background-error {
  position: absolute;
  bottom: 0;
  left: 8%;
  font-size: 12px;
  background: #10151fdc;
  padding: 6px 12px;
  color: var(--text, #e7eef5);
}
.background-error button {
  background: none;
  color: var(--accent, #8dbffd);
  border: 0;
  min-height: 32px;
}
</style>

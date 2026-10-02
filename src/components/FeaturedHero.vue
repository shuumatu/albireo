<script setup lang="ts">
import { ref, nextTick, onMounted, onBeforeUnmount, onDeactivated } from 'vue'
import {
  edgeVelocity,
  createPanMotion,
  horizontalOverflow
} from '../utils/panorama'
import bay from '../assets/bg4.JPG?url'
import mountain from '../assets/bg2.JPG?url'
import stars from '../assets/bg5.jpg?url'
import river from '../assets/bg1.JPG?url'
import night from '../assets/bg3.JPG?url'
interface Slide {
  src: string
  title: string
  type: string
}
const titles = ['海湾的夜色', '雪线之上', '星野记录', '冬日河岸', '山野的长夜']
// These panoramas need their original height: width-limited thumbnails blur under cover.
const sources = [bay, mountain, stars, river, night]
const slides: Slide[] = titles.map((title, i) => ({
  title,
  type: '摄影作品',
  src: sources[i]!
}))
const active = ref(0),
  current = ref<Slide>(slides[0]!),
  previous = ref<Slide | null>(null)
const front = ref<HTMLImageElement>(),
  failure = ref(false)
const hero = ref<HTMLElement>()
const pan = ref(50)
const panDirection = ref(0)
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
const cache = new Map<string, Promise<void>>()
let request = 0,
  failedIndex = 0
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
  if (!pointer || !hero.value || !front.value) return
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
  if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return
  if ((event.target as Element).closest('button, a, .hero-error')) {
    stopPan()
    return
  }
  pointer = { x: event.clientX, y: event.clientY }
  updatePan()
}
function keyPan(event: KeyboardEvent) {
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
  if (document.hidden) stopPan()
}
function ready(slide: Slide) {
  const src = slide.src
  if (!cache.has(src)) {
    const image = new Image()
    image.src = src
    cache.set(
      src,
      image.decode().catch((e) => {
        cache.delete(src)
        throw e
      })
    )
  }
  return cache.get(src)!
}
async function select(index: number, force = false) {
  stopPan()
  const id = ++request,
    slide = slides[index]
  if (!slide) return
  if (current.value.src === slide.src && !force && !failure.value) {
    active.value = index
    current.value = slide
    failure.value = false
    return
  }
  try {
    await ready(slide)
  } catch {
    if (id === request) {
      failedIndex = index
      failure.value = true
    }
    return
  }
  if (id !== request) return
  motion.stop()
  front.value?.getAnimations().forEach((a) => a.cancel())
  previous.value = current.value
  current.value = { ...slide }
  active.value = index
  failure.value = false
  await nextTick()
  updatePan()
  if (!reduced.matches)
    front.value?.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 280,
      easing: 'ease-out'
    })
}
function enter(event: PointerEvent, index: number) {
  if (event.pointerType === 'mouse') void select(index)
}
function explore(event: MouseEvent) {
  event.preventDefault()
  document
    .getElementById('selected')
    ?.scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth' })
  document.getElementById('selected')?.focus({ preventScroll: true })
}
function imageError() {
  stopPan()
  failure.value = true
  failedIndex = active.value
}
onMounted(() => {
  window.addEventListener('blur', stopPan)
  window.addEventListener('resize', stopPan)
  document.addEventListener('visibilitychange', visibilityChanged)
})
onDeactivated(stopPan)
onBeforeUnmount(() => {
  request++
  stopPan()
  window.removeEventListener('blur', stopPan)
  window.removeEventListener('resize', stopPan)
  document.removeEventListener('visibilitychange', visibilityChanged)
})
</script>
<template>
  <section class="featured-hero" aria-label="精选画面">
    <div
      ref="hero"
      class="hero"
      :style="{ '--hero-pan': `${pan}%` }"
      tabindex="0"
      aria-label="全景照片，鼠标移至左右边缘平移，也可使用左右方向键"
      @pointermove="movePan"
      @pointerenter="movePan"
      @pointerleave="stopPan"
      @pointercancel="stopPan"
      @keydown="keyPan"
    >
      <img
        v-if="previous"
        id="hero-back"
        :src="previous.src"
        alt=""
        aria-hidden="true"
        draggable="false"
      />
      <img
        :key="current.src + (failure ? 'failed' : 'ready')"
        ref="front"
        :src="current.src"
        :alt="current.title"
        fetchpriority="high"
        draggable="false"
        @error="imageError"
        @load="updatePan"
      />
      <div class="hero-shade" aria-hidden="true"></div>
      <div
        class="pan-cue pan-cue-left"
        :class="{ 'is-visible': panDirection === -1, 'at-limit': pan <= 0 }"
        aria-hidden="true"
      >
        <svg viewBox="0 0 32 32" fill="none">
          <path d="m20 6-10 10 10 10" />
        </svg>
      </div>
      <div
        class="pan-cue pan-cue-right"
        :class="{ 'is-visible': panDirection === 1, 'at-limit': pan >= 100 }"
        aria-hidden="true"
      >
        <svg viewBox="0 0 32 32" fill="none">
          <path d="m12 6 10 10-10 10" />
        </svg>
      </div>
      <div class="hero-bottom">
        <div class="hero-caption">
          <span class="mono muted"
            >FEATURED / {{ String(active + 1).padStart(3, '0') }}</span
          >
          <h2>{{ current.title }}</h2>
          <span class="image-label">{{ current.type }}</span>
        </div>
        <div class="selector-dock">
          <div
            class="slide-controls"
            role="group"
            aria-label="悬停、聚焦或轻触切换画面"
          >
            <button
              v-for="(slide, index) in slides"
              :key="`${slide.src}-${index}`"
              :aria-label="`查看${slide.title}`"
              :aria-pressed="active === index"
              @pointerenter="enter($event, index)"
              @focus="select(index)"
              @click="select(index)"
            >
              <i class="selector-mark" aria-hidden="true"></i>
            </button>
          </div>
          <div
            class="frame-count mono"
            :aria-label="`当前第 ${active + 1} 张，共 ${slides.length} 张`"
          >
            <span id="slide-number">{{
              String(active + 1).padStart(2, '0')
            }}</span
            ><span class="frame-total" aria-hidden="true"
              >/ {{ String(slides.length).padStart(2, '0') }}</span
            >
          </div>
        </div>
        <a class="scroll-link mono" href="#selected" @click="explore"
          >SCROLL TO EXPLORE <span aria-hidden="true">↓</span></a
        >
      </div>
      <div v-if="failure" class="hero-error" role="status">
        画面暂时无法加载
        <button @click="select(failedIndex, true)">重试</button>
      </div>
    </div>
  </section>
</template>
<style scoped>
.featured-hero {
  container-type: inline-size;
}
.hero {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  background: #111a22;
}
.hero > img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: var(--hero-pan, 50%) center;
  user-select: none;
  z-index: -3;
}
.hero-shade {
  position: absolute;
  inset: 0;
  z-index: -2;
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
.hero-bottom {
  position: absolute;
}
.mono {
  font-family: var(--mono);
}
.image-label {
  font-size: 11px;
  color: #aebbc1;
}
.hero-caption > .mono {
  font-size: 10px;
  letter-spacing: 1px;
}
.hero-bottom .scroll-link {
  font-size: 10px;
  letter-spacing: 1px;
}
.scroll-link span {
  font-size: 25px;
}
.hero-error {
  position: absolute;
  bottom: 0;
  left: 8%;
  font-size: 12px;
  background: #10151fdc;
  padding: 6px 12px;
  color: var(--text);
}
.hero-error button {
  background: none;
  color: var(--accent);
  border: 0;
  min-height: 32px;
}
.hero {
  height: clamp(480px, calc(100svh - var(--header-height)), 880px);
}
.hero #hero-back {
  z-index: -4;
}
.hero-shade {
  background: linear-gradient(
    0deg,
    #061017b8 0%,
    #06101726 22%,
    transparent 42%
  );
  pointer-events: none;
}
.hero-bottom {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  z-index: 2;
  bottom: 42px;
  left: 8%;
  right: 8%;
  align-items: center;
  gap: 32px;
}
.hero-caption {
  min-width: 0;
  text-shadow: 0 1px 8px #0008;
}
.hero-caption > .mono {
  color: var(--star-gold-bright);
}
.hero-bottom h2 {
  margin: 9px 0 8px;
  font-size: 21px;
  font-weight: 650;
  letter-spacing: 2px;
  overflow-wrap: anywhere;
}
.hero-bottom .scroll-link {
  display: flex;
  min-height: 44px;
  white-space: nowrap;
  margin-left: 8px;
  gap: 14px;
  color: #d6dfe3;
  text-shadow: 0 1px 8px #0008;
}
.hero-bottom .scroll-link span {
  transition: transform 0.18s;
}
.hero-bottom .scroll-link:is(:hover, :focus-visible) {
  color: var(--accent);
}
.hero-bottom .scroll-link:is(:hover, :focus-visible) span {
  transform: translateY(3px);
}
.selector-dock {
  display: flex;
  align-items: center;
  gap: 30px;
  flex-shrink: 0;
}
.slide-controls {
  position: relative;
  display: flex;
  gap: 4px;
  margin: 0;
  width: auto;
  flex-shrink: 0;
}
.slide-controls button {
  position: relative;
  display: grid;
  place-items: center;
  flex: 0 0 44px;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 0;
  background: transparent;
  border-radius: 0;
}
.slide-controls button:before {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: 28px;
  height: 32px;
  background: linear-gradient(90deg, var(--star-blue-soft), #80b5f408);
  opacity: 0;
  transform: translate(-50%, -50%) skewX(-24deg) scaleY(0.7);
  transition:
    opacity 0.2s,
    transform 0.22s;
  pointer-events: none;
}
.slide-controls button:after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  width: 16px;
  height: 1px;
  background: var(--accent-warm);
  opacity: 0;
  transform: translateX(-50%) scaleX(0.4);
  transition:
    opacity 0.2s,
    transform 0.22s;
  pointer-events: none;
}
.slide-controls .selector-mark {
  position: relative;
  display: block;
  width: 3px;
  height: 18px;
  transform: skewX(-24deg);
  background: #d4e2f5a6;
  transition:
    width 0.22s cubic-bezier(0.2, 0.7, 0.2, 1),
    height 0.22s,
    background 0.18s;
  pointer-events: none;
}
.slide-controls button[aria-pressed='true']:before {
  opacity: 1;
  transform: translate(-50%, -50%) skewX(-24deg) scaleY(1);
}
.slide-controls button[aria-pressed='true'] .selector-mark {
  width: 18px;
  height: 24px;
  background: linear-gradient(
    90deg,
    var(--star-gold) 0 2px,
    transparent 2px 5px,
    var(--accent) 5px
  );
}
.slide-controls button[aria-pressed='true']:after {
  opacity: 0.8;
  transform: translateX(-50%) scaleX(1);
}
.slide-controls button:focus-visible {
  outline-offset: 2px;
}
.slide-controls button:focus-visible .selector-mark {
  width: 8px;
  height: 22px;
  background-color: var(--accent);
}
.slide-controls button[aria-pressed='true']:focus-visible .selector-mark {
  width: 18px;
  height: 24px;
}
@media (any-hover: hover) {
  .slide-controls button:hover:before {
    opacity: 1;
    transform: translate(-50%, -50%) skewX(-24deg) scaleY(1);
  }
  .slide-controls button:hover .selector-mark {
    width: 8px;
    height: 22px;
    background-color: var(--accent);
  }
  .slide-controls button[aria-pressed='true']:hover .selector-mark {
    width: 18px;
    height: 24px;
  }
}
.hero-bottom .frame-count {
  display: flex;
  align-items: baseline;
  gap: 12px;
  font-size: 48px;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0;
  white-space: nowrap;
  text-shadow: 0 1px 8px #0008;
}
.frame-count #slide-number {
  font-family: Arial, sans-serif;
  font-weight: 700;
  letter-spacing: -2px;
  color: var(--accent-warm);
}
.frame-count .frame-total {
  font-size: 12px;
  color: #d6dfe3;
}

@container (max-width:900px) {
  .hero-bottom {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 12px 18px;
  }
  .hero-bottom .scroll-link {
    grid-column: 2;
    grid-row: 1;
    margin-left: 0;
  }
  .selector-dock {
    grid-column: 1 / -1;
    grid-row: 2;
    justify-content: space-between;
  }
}
@container (max-width:650px) {
  .hero {
    height: clamp(480px, 72svh, 680px);
  }
  .hero-bottom {
    left: 24px;
    right: 24px;
    bottom: 24px;
    gap: 8px 14px;
  }
  .hero-bottom h2 {
    font-size: 19px;
    letter-spacing: 1px;
  }
  .hero-caption > .mono {
    font-size: 9px;
  }
  .selector-dock {
    gap: 12px;
  }
  .slide-controls {
    margin-left: -12px;
    gap: 0;
  }
  .hero-bottom .frame-count {
    font-size: 36px;
    gap: 9px;
  }
  .frame-count #slide-number {
    letter-spacing: -1px;
  }
  .frame-count .frame-total {
    font-size: 11px;
  }
}
</style>

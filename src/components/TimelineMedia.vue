<script lang="ts">
// Row repacking can remount a tile. Do not replay the reveal for decoded URLs.
const decodedSources = new Set<string>()
function rememberSource(src: string) {
  decodedSources.add(src)
  if (decodedSources.size > 500)
    decodedSources.delete(decodedSources.values().next().value!)
}
</script>

<script setup lang="ts">
import { computed, nextTick, onActivated, onDeactivated, onMounted, onUnmounted, ref, watch } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

const props = defineProps<{
  src: string
  previewSrc?: string
  to: RouteLocationRaw
  isVideo?: boolean
  width?: number
  height?: number
}>()
const emit = defineEmits<{ load: [image: HTMLImageElement] }>()
const tile = ref<HTMLElement>()
const image = ref<HTMLImageElement>()
const started = ref(false)
const nearViewport = ref(false)
const ready = ref(false)
const failed = ref(false)
const previewReady = ref(false)
const previewFailed = ref(false)
const slow = ref(false)
const skipReveal = ref(false)
const attempt = ref(0)
const preview = computed(() =>
  props.previewSrc && props.previewSrc !== props.src ? props.previewSrc : ''
)
const state = computed(() => !props.src ? 'missing' : failed.value ? 'error' : ready.value ? 'ready' : started.value ? 'loading' : 'idle')
let observer: IntersectionObserver | undefined
let slowTimer: ReturnType<typeof setTimeout> | undefined
let generation = 0

function clearSlowTimer() {
  clearTimeout(slowTimer)
  slowTimer = undefined
}
function scheduleSlowHint() {
  clearSlowTimer()
  if (nearViewport.value && started.value && props.src && !ready.value && !failed.value)
    slowTimer = setTimeout(() => { slow.value = true }, 3000)
}
async function reveal(event: Event | HTMLImageElement, cached = false) {
  const img = event instanceof HTMLImageElement ? event : event.target as HTMLImageElement
  const currentGeneration = generation
  if (img !== image.value || ready.value || failed.value) return
  try {
    await img.decode()
  } catch {
    if (currentGeneration === generation && img === image.value) fail()
    return
  }
  if (currentGeneration !== generation || img !== image.value || ready.value || !img.naturalWidth) return
  skipReveal.value = cached || decodedSources.has(props.src)
  rememberSource(props.src)
  ready.value = true
  slow.value = false
  clearSlowTimer()
  emit('load', img)
}
function fail() {
  failed.value = true
  slow.value = false
  clearSlowTimer()
}
async function start() {
  if (!props.src || started.value) return
  started.value = true
  scheduleSlowHint()
  await nextTick()
  // A memory/disk-cached image may already be complete before its load handler.
  if (image.value?.complete && image.value.naturalWidth) void reveal(image.value, true)
}
function observe() {
  observer?.disconnect()
  if (!tile.value) return
  observer = new IntersectionObserver(([entry]) => {
    nearViewport.value = !!entry?.isIntersecting
    if (nearViewport.value) {
      void start()
      scheduleSlowHint()
    } else clearSlowTimer()
  }, { root: tile.value.closest('.main-content'), rootMargin: '240px 0px' })
  observer.observe(tile.value)
}
function suspend() {
  observer?.disconnect()
  clearSlowTimer()
  nearViewport.value = false
}
function reset() {
  generation++
  clearSlowTimer()
  started.value = false
  ready.value = false
  failed.value = false
  previewReady.value = false
  previewFailed.value = false
  slow.value = false
  skipReveal.value = decodedSources.has(props.src)
  attempt.value++
  if (nearViewport.value) void start()
}
watch(() => [props.src, props.previewSrc], reset)
onMounted(observe)
onActivated(observe)
onDeactivated(suspend)
onUnmounted(() => { generation++; suspend() })
</script>

<template>
  <div
    ref="tile"
    class="timeline-media"
    :class="{ 'is-ready': ready, 'has-preview': previewReady, 'skip-reveal': skipReveal, 'is-near': nearViewport }"
    :data-state="state"
  >
    <router-link class="media-link" :to="to" :aria-label="`查看${isVideo ? '视频' : '图片'}详情`" :aria-busy="state === 'loading'">
      <div class="media-placeholder" aria-hidden="true">
        <img
          v-if="started && preview && !previewFailed"
          :key="`${preview}-${attempt}`"
          class="media-preview"
          :src="preview"
          alt=""
          decoding="async"
          @load="previewReady = true"
          @error="previewFailed = true; previewReady = false"
        />
        <span class="media-breath"></span>
      </div>
      <img
        v-if="started && src"
        :key="`${src}-${attempt}`"
        ref="image"
        class="media-image"
        :src="src"
        :width="width"
        :height="height"
        alt=""
        decoding="async"
        draggable="false"
        @load="reveal"
        @error="fail"
      />
      <span v-if="!src || failed" class="media-message">{{ !src ? '暂无封面' : '封面加载失败' }}</span>
      <span v-else-if="slow && nearViewport" class="media-slow">仍在加载</span>
      <span v-if="isVideo" class="video-indicator" aria-hidden="true">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" fill="rgba(0,0,0,0.6)" />
          <path d="M10 8L16 12L10 16V8Z" fill="var(--star-blue)" />
        </svg>
      </span>
    </router-link>
    <button v-if="failed && src" class="media-retry" type="button" aria-label="重试加载封面" @click.stop="reset" @mousedown.stop>重试</button>
  </div>
</template>

<style scoped>
.timeline-media { position: relative; overflow: hidden; isolation: isolate; background: var(--surface); }
.media-link { position: absolute; inset: 0; display: block; }
.media-link:focus-visible { outline-offset: -3px; z-index: 2; }
.media-placeholder { position: absolute; inset: 0; overflow: hidden; background: radial-gradient(ellipse at 25% 20%, var(--surface-raised), transparent 75%), var(--surface); opacity: 1; transition: opacity 320ms ease-out, visibility 0s 320ms; }
.media-preview { position: absolute; inset: -12%; width: 124%; height: 124%; max-width: none; object-fit: cover; filter: blur(18px); opacity: 0; transition: opacity 180ms ease-out; }
.has-preview .media-preview { opacity: 0.75; }
.media-breath { position: absolute; inset: 0; background: var(--surface); opacity: 0.24; }
.is-near[data-state='loading'] .media-breath { animation: media-breathe 2.4s ease-in-out infinite; }
.media-image { display: block; position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; opacity: 0; filter: blur(4px); transition: opacity 320ms ease-out, filter 360ms ease-out; }
.is-ready .media-image { opacity: 1; filter: blur(0); }
.is-ready .media-placeholder { opacity: 0; visibility: hidden; }
.skip-reveal .media-image, .skip-reveal .media-placeholder { transition: none; }
.media-message { position: absolute; inset: 0; display: grid; place-items: center; color: var(--muted); font-size: 12px; text-align: center; padding: 8px; }
[data-state='error'] .media-message { padding-bottom: 44px; }
.media-slow { position: absolute; bottom: 8px; left: 8px; padding: 3px 6px; background: var(--bg); color: var(--muted); font-size: 11px; max-width: calc(100% - 44px); }
.media-retry { position: absolute; top: 50%; left: 50%; transform: translateX(-50%); padding: 0 10px; min-height: 36px; border: 1px solid var(--line); background: var(--bg); color: var(--accent); font-size: 12px; }
.video-indicator { position: absolute; bottom: 8px; right: 8px; pointer-events: none; display: flex; }
@keyframes media-breathe { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.1; } }
@media (pointer: coarse) { .media-retry { min-height: 44px; min-width: 44px; } }
@media (prefers-reduced-motion: reduce) {
  .media-image, .media-placeholder, .media-preview { transition: none; }
  .is-near[data-state='loading'] .media-breath { animation: none; }
}
</style>

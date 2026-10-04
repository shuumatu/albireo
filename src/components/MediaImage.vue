<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import type { MediaRendition } from '../types/media'
import { fittedImageWidth, imageCandidates } from '../utils/mediaQuality'

defineOptions({ inheritAttrs: false })
const props = withDefaults(defineProps<{
  src?: string | null
  renditions?: MediaRendition[]
  alt?: string
  fit?: 'cover' | 'contain'
  loading?: 'lazy' | 'eager'
}>(), { src: '', alt: '', fit: 'cover', loading: 'lazy' })
const emit = defineEmits<{ load: [event: Event]; error: [event: Event] }>()
const image = ref<HTMLImageElement>()
const measured = ref(false)
const width = ref(1)
const height = ref(0)
let observer: ResizeObserver | undefined
const formats = computed(() => ['image/avif', 'image/webp'].map(mimeType => ({
  mimeType, candidates: imageCandidates(props.renditions, mimeType)
})).filter(format => format.candidates.length))
const sizes = computed(() => {
  const source = formats.value[0]?.candidates[0]
  // Browser applies its DPR to sizes. Compensate on >2x screens to cap downloads at 2x.
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1
  const fitted = source ? fittedImageWidth(width.value, height.value, source.width, source.height, props.fit) : width.value
  return `${Math.ceil(fitted * Math.min(2, dpr) / dpr)}px`
})
const fallback = computed(() => imageCandidates(props.renditions, 'image/webp')[0]?.url || props.src || undefined)
const srcset = (candidates: MediaRendition[]) => candidates.map(r => `${r.url} ${r.width}w`).join(', ')
function measure() {
  const element = image.value
  if (!element) return
  const bounds = element.getBoundingClientRect()
  const parent = element.parentElement?.getBoundingClientRect()
  width.value = bounds.width || parent?.width || 1
  height.value = bounds.height || 0
  measured.value = true
}
onMounted(() => {
  measure()
  observer = new ResizeObserver(measure)
  if (image.value) observer.observe(image.value)
})
onBeforeUnmount(() => observer?.disconnect())
defineExpose({ image })
</script>

<template>
  <picture class="media-picture">
    <source v-for="format in formats" :key="format.mimeType" :type="format.mimeType"
      :srcset="measured ? srcset(format.candidates) : undefined" :sizes="sizes" />
    <img ref="image" v-bind="$attrs" :src="measured ? fallback : undefined" :alt="alt" :loading="loading"
      :sizes="sizes" decoding="async" :style="{ objectFit: fit, display: 'block' }"
      @load="emit('load', $event)" @error="emit('error', $event)" />
  </picture>
</template>

<style scoped>
.media-picture { display: contents; }
</style>

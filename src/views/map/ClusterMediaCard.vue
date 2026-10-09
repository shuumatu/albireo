<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { NIcon, NSpin } from 'naive-ui'
import { ImageOutline, RefreshOutline, VideocamOutline } from '@vicons/ionicons5'
import MediaImage from '../../components/MediaImage.vue'
import type { MapPointVO } from '../../api/map'
import { imageCandidates } from '../../utils/mediaQuality'

const props = defineProps<{ item: MapPointVO; thumbnailSrc: string }>()
const emit = defineEmits<{ select: []; hover: [active: boolean] }>()
const imageState = ref<'loading' | 'loaded' | 'failed'>('loading')
const attempt = ref(0)
const hasPreview = computed(() => Boolean(props.thumbnailSrc)
  || imageCandidates(props.item.renditions, 'image/avif').length > 0
  || imageCandidates(props.item.renditions, 'image/webp').length > 0)
const previewSignature = computed(() => JSON.stringify([props.thumbnailSrc, props.item.renditions]))

watch(previewSignature, () => {
  imageState.value = 'loading'
  attempt.value += 1
})

function retryPreview() {
  imageState.value = 'loading'
  attempt.value += 1
}
</script>

<template>
  <div class="media-item" @mouseenter="emit('hover', true)" @mouseleave="emit('hover', false)">
    <button
      class="media-open"
      type="button"
      :aria-label="`查看${item.mediaType === 'video' ? '视频' : '图片'}`"
      @click="emit('select')"
      @focus="emit('hover', true)"
      @blur="emit('hover', false)"
    >
      <MediaImage
        v-if="hasPreview"
        :key="attempt"
        :renditions="item.renditions"
        :src="thumbnailSrc"
        class="media-thumb"
        :class="{ 'is-loaded': imageState === 'loaded' }"
        loading="lazy"
        :alt="item.uuid"
        @load="imageState = 'loaded'"
        @error="imageState = 'failed'"
      />
      <span v-if="hasPreview && imageState === 'loading'" class="preview-status loading" role="status">
        <n-spin size="small" />
        <span>加载预览…</span>
      </span>
      <span v-else-if="!hasPreview || imageState === 'failed'" class="preview-status">
        <n-icon :component="item.mediaType === 'video' ? VideocamOutline : ImageOutline" :size="26" />
        <span>{{ hasPreview ? '预览加载失败' : '暂无预览图' }}</span>
        <span class="preview-hint">点击查看媒体</span>
      </span>
      <span class="media-overlay" />
      <span class="media-type" :class="item.mediaType" aria-hidden="true">
        <n-icon :component="item.mediaType === 'video' ? VideocamOutline : ImageOutline" :size="13" />
      </span>
    </button>
    <button
      v-if="hasPreview && imageState === 'failed'"
      class="preview-retry"
      type="button"
      aria-label="重试加载预览"
      @click.stop="retryPreview"
    >
      <n-icon :component="RefreshOutline" :size="12" />
      重试
    </button>
  </div>
</template>

<style>
.cluster-drawer .media-item {
  position: relative;
  min-width: 0;
  aspect-ratio: 1;
  background: var(--bg);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.cluster-drawer .media-item:hover {
  transform: translateY(-2px);
  box-shadow: var(--map-shadow-md);
  z-index: 2;
}

.cluster-drawer .media-open {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  overflow: hidden;
  background: transparent;
  color: var(--map-text-secondary);
  font: inherit;
  cursor: pointer;
}

/* MediaImage forwards its class to img. Global styles need a direct selector. */
.cluster-drawer .media-thumb {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  opacity: 0;
  transition: transform 0.4s ease, opacity 0.2s ease;
}

.cluster-drawer .media-thumb.is-loaded { opacity: 1; }
.cluster-drawer .media-item:hover .media-thumb { transform: scale(1.05); }

.cluster-drawer .preview-status {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 22px 8px 29px;
  box-sizing: border-box;
  background: color-mix(in srgb, var(--surface) 70%, var(--bg));
  font-size: 11px;
  line-height: 1.4;
  text-align: center;
}

.cluster-drawer .preview-status.loading { padding: 22px 8px; }
.cluster-drawer .preview-hint { color: var(--map-text-tertiary); font-size: 10px; }

.cluster-drawer .media-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(to top, rgb(0 0 0 / 30%) 0%, transparent 40%);
  opacity: 0;
  transition: opacity 0.2s ease;
}

.cluster-drawer .media-item:hover .media-overlay { opacity: 1; }

.cluster-drawer .media-type {
  position: absolute;
  top: 6px;
  left: 6px;
  width: 22px;
  height: 22px;
  border-radius: 7px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--accent-ink);
  border: 1px solid var(--map-glass-border);
}

.cluster-drawer .media-type.video { background: var(--map-video); }
.cluster-drawer .media-type.image { background: var(--map-image); }

.cluster-drawer .preview-retry {
  position: absolute;
  bottom: 6px;
  left: 50%;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 7px;
  border: 1px solid var(--map-glass-border-strong);
  border-radius: 4px;
  color: var(--map-text-primary);
  background: var(--map-glass-bg-strong);
  font: inherit;
  font-size: 10px;
  cursor: pointer;
}

.cluster-drawer .media-open:focus-visible,
.cluster-drawer .preview-retry:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; z-index: 3; }

@media (prefers-reduced-motion: reduce) {
  .cluster-drawer .media-item,
  .cluster-drawer .media-thumb,
  .cluster-drawer .media-overlay { transition: none; }
  .cluster-drawer .media-item:hover,
  .cluster-drawer .media-item:hover .media-thumb { transform: none; }
}
</style>

<template>
  <router-link
    class="media-card"
    :class="{ 'is-video': item.itemType === 'video' }"
    :to="detailRoute"
  >
    <div class="media-thumb">
      <MediaImage
        v-if="hasImage && !errored"
        :key="`${imageSourceKey}-${useThumbnailFallback}`"
        :renditions="useThumbnailFallback ? undefined : imageRenditions"
        :src="item.thumbnailUrl"
        alt=""
        loading="lazy"
        @error="onImageError"
      />
      <div v-else class="media-placeholder">
        <span class="placeholder-icon" aria-hidden="true">{{
          item.itemType === 'video' ? '▶' : '▧'
        }}</span>
        <span>{{ errored ? '封面暂不可用' : '暂无封面' }}</span>
      </div>

      <span v-if="item.itemType === 'video'" class="video-badge" role="img" aria-label="视频">
        <span class="play-icon" aria-hidden="true">▶</span>
      </span>

      <div v-if="item.likeCount > 0 || item.commentCount > 0" class="hover-overlay">
        <div class="overlay-meta">
          <span v-if="item.likeCount > 0" class="meta-pill">
            <span class="meta-icon" aria-hidden="true">♥</span>{{ item.likeCount }}<span class="sr-only"> 个赞</span>
          </span>
          <span v-if="item.commentCount > 0" class="meta-pill">
            <span class="meta-icon" aria-hidden="true">◇</span>{{ item.commentCount }}<span class="sr-only"> 条评论</span>
          </span>
        </div>
      </div>
    </div>

    <div class="media-info">
      <div class="media-title" :title="displayTitle">{{ displayTitle }}</div>
      <div v-if="formattedDate" class="media-date">{{ formattedDate }}</div>
    </div>
  </router-link>
</template>

<script setup lang="ts">
import MediaImage from './MediaImage.vue'

import { computed, ref, watch } from 'vue'
import type { RecommendItemVO } from '../api/recommend'
import { imageCandidates } from '../utils/mediaQuality'

interface Props {
  item: RecommendItemVO
}

const props = defineProps<Props>()
const detailRoute = computed(() =>
  props.item.itemType === 'video'
    ? { name: 'VideoPlayer', params: { uuid: props.item.uuid } }
    : { name: 'ImageDetail', params: { uuid: props.item.uuid } }
)

const fallbackTitle = computed(() => {
  return props.item.itemType === 'video' ? '未命名视频' : '未命名图片'
})

const displayTitle = computed(() => {
  const t = props.item.title
  if (t && t.trim().length > 0) return t
  return fallbackTitle.value
})

const errored = ref(false)
const useThumbnailFallback = ref(false)
const imageRenditions = computed(() => [
  ...imageCandidates(props.item.renditions, 'image/avif'),
  ...imageCandidates(props.item.renditions, 'image/webp')
])
const hasImage = computed(() => Boolean(props.item.thumbnailUrl || imageRenditions.value.length))
const imageSourceKey = computed(() => JSON.stringify([
  props.item.itemType,
  props.item.uuid,
  props.item.thumbnailUrl,
  imageRenditions.value
]))

// Search and refresh can reuse the same card instance for a repaired cover.
watch([() => props.item, imageSourceKey], () => {
  errored.value = false
  useThumbnailFallback.value = false
}, { flush: 'sync' })

const formattedDate = computed(() => {
  const raw = props.item.shotAt || props.item.createdAt
  if (!raw) return ''
  const d = new Date(raw)
  if (isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
})

function onImageError() {
  // A failed responsive rendition should still try the original cover once.
  if (!useThumbnailFallback.value && imageRenditions.value.length && props.item.thumbnailUrl) {
    useThumbnailFallback.value = true
    return
  }
  errored.value = true
}
</script>

<style scoped>
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.media-card {
  color: var(--text);
  text-decoration: none;
  position: relative;
  width: 280px;
  max-width: 100%;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  min-width: 0;
  cursor: pointer;
  background: transparent;
}
.media-card:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 4px;
}
.media-thumb {
  position: relative;
  width: 100%;
  aspect-ratio: 4/3;
  background: var(--surface);
  overflow: hidden;
}
.media-thumb :deep(img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.22s;
}
.media-card:is(:hover, :focus-visible) :deep(img) {
  transform: scale(1.025);
}
.media-thumb:after {
  content: '';
  position: absolute;
  inset: 9px;
  pointer-events: none;
  background:
    linear-gradient(var(--star-gold), var(--star-gold)) left top/14px 1px
      no-repeat,
    linear-gradient(var(--star-gold), var(--star-gold)) left top/1px 14px
      no-repeat,
    linear-gradient(var(--star-blue), var(--star-blue)) right bottom/14px 1px
      no-repeat,
    linear-gradient(var(--star-blue), var(--star-blue)) right bottom/1px 14px
      no-repeat;
  opacity: 0;
  transition: opacity 0.2s;
}
.media-card:is(:hover, :focus-visible) .media-thumb:after {
  opacity: 1;
}
.media-placeholder {
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 8px;
  color: var(--muted);
  font: 12px var(--mono);
}
.placeholder-icon {
  font-size: 24px;
}
.video-badge {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 32px;
  height: 32px;
  background: #10151fcc;
  display: grid;
  place-items: center;
  color: var(--on-photo-blue);
}
.play-icon {
  font-size: 12px;
}
.hover-overlay {
  position: absolute;
  inset: 50% 0 0;
  background: linear-gradient(transparent, #061017b3);
  display: flex;
  align-items: end;
  padding: 12px;
  opacity: 0;
  transition: opacity 0.2s;
}
.media-card:is(:hover, :focus-visible) .hover-overlay {
  opacity: 1;
}
.overlay-meta {
  display: flex;
  gap: 12px;
}
.meta-pill {
  font: 11px var(--mono);
  color: #f1eee6;
  display: flex;
  gap: 4px;
}
.media-info {
  padding: 16px 0;
  border-bottom: 1px solid var(--line);
}
.media-title {
  font-size: 15px;
  letter-spacing: 0.5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.media-title:before {
  content: '';
  display: inline-block;
  width: 4px;
  height: 4px;
  background: var(--accent-warm);
  vertical-align: middle;
  margin-right: 9px;
}
.is-video .media-title:before {
  background: var(--accent);
}
.media-card:is(:hover, :focus-visible) .media-info {
  border-color: var(--accent);
}
.media-date {
  margin-top: 6px;
  font: 11px var(--mono);
  color: var(--muted);
}
@media (max-width: 700px) {
  .media-card {
    width: 240px;
  }
  .hover-overlay {
    opacity: 1;
  }
}
@media (hover: none) {
  .hover-overlay {
    opacity: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .media-thumb :deep(img),
  .media-thumb:after,
  .hover-overlay {
    transition: none;
  }
}
</style>

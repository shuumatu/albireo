<template>
  <router-link
    class="media-card"
    :class="{ 'is-video': item.itemType === 'video' }"
    :to="detailRoute"
  >
    <div class="media-thumb">
      <img
        v-if="thumbSrc"
        :src="thumbSrc"
        :alt="displayTitle"
        loading="lazy"
        @error="onImageError"
      />
      <div v-else class="media-placeholder">
        <span class="placeholder-icon">{{
          item.itemType === 'video' ? '▶' : '▧'
        }}</span>
      </div>

      <span v-if="item.itemType === 'video'" class="video-badge">
        <span class="play-icon">▶</span>
      </span>

      <div class="hover-overlay">
        <div class="overlay-meta">
          <span v-if="item.likeCount > 0" class="meta-pill">
            <span class="meta-icon">♥</span>{{ item.likeCount }}
          </span>
          <span v-if="item.commentCount > 0" class="meta-pill">
            <span class="meta-icon">◇</span>{{ item.commentCount }}
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
import { computed, ref } from 'vue'
import type { RecommendItemVO } from '../api/recommend'

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

const thumbSrc = computed(() => {
  if (errored.value) return ''
  return props.item.thumbnailUrl || ''
})

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
  errored.value = true
}
</script>

<style scoped>
.media-card {
  color: var(--text);
  text-decoration: none;
  position: relative;
  width: 280px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  min-width: 0;
  cursor: pointer;
  background: transparent;
}
.media-thumb {
  position: relative;
  width: 100%;
  aspect-ratio: 4/3;
  background: var(--surface);
  overflow: hidden;
}
.media-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.22s;
}
.media-card:is(:hover, :focus-visible) img {
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
  display: grid;
  place-items: center;
  color: var(--muted);
  font: 12px var(--mono);
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
  color: var(--star-blue-bright);
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
}
</style>

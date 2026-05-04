<template>
  <div
    class="media-card"
    :class="{ 'is-video': item.itemType === 'video' }"
    @click="handleClick"
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
        <span class="placeholder-icon">{{ item.itemType === 'video' ? '▶' : '🖼' }}</span>
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
            <span class="meta-icon">💬</span>{{ item.commentCount }}
          </span>
        </div>
      </div>
    </div>

    <div class="media-info">
      <div class="media-title" :title="displayTitle">{{ displayTitle }}</div>
      <div v-if="formattedDate" class="media-date">{{ formattedDate }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { RecommendItemVO } from '../api/recommend'

interface Props {
  item: RecommendItemVO
}

const props = defineProps<Props>()
const router = useRouter()

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

function handleClick() {
  const route = props.item.itemType === 'video'
    ? router.resolve({ name: 'VideoPlayer', params: { uuid: props.item.uuid } })
    : router.resolve({ name: 'ImageDetail', params: { uuid: props.item.uuid } })
  window.open(route.href, '_blank')
}
</script>

<style scoped>
.media-card {
  position: relative;
  width: 240px;
  flex-shrink: 0;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  border-radius: 10px;
  overflow: hidden;
  background-color: #1a1a1a;
  transition: transform 0.25s ease, box-shadow 0.25s ease;
}

.media-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.45);
}

.media-thumb {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 3;
  background-color: #0e0e0e;
  overflow: hidden;
}

.media-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.4s ease;
}

.media-card:hover .media-thumb img {
  transform: scale(1.06);
}

.media-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.3);
  font-size: 28px;
}

.video-badge {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background-color: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  pointer-events: none;
  transition: background-color 0.25s ease;
}

.media-card:hover .video-badge {
  background-color: rgba(0, 0, 0, 0.78);
}

.play-icon {
  font-size: 16px;
  margin-left: 3px;
}

.hover-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.65) 0%, rgba(0, 0, 0, 0) 50%);
  display: flex;
  align-items: flex-end;
  padding: 10px;
  opacity: 0;
  transition: opacity 0.25s ease;
}

.media-card:hover .hover-overlay {
  opacity: 1;
}

.overlay-meta {
  display: flex;
  gap: 8px;
}

.meta-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 12px;
  background-color: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(4px);
  font-size: 12px;
  color: white;
}

.meta-icon {
  font-size: 11px;
}

.media-info {
  padding: 10px 12px 14px;
  color: rgba(255, 255, 255, 0.9);
}

.media-title {
  font-size: 14px;
  line-height: 1.4;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.media-date {
  margin-top: 4px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}
</style>

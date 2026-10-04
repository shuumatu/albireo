<template>
  <n-card :bordered="false">
    <div class="video-container">
      <VideoPlayer :playback="content.playback" :video-sources="videoSources" :poster="content.posterUrl || content.coverUrl" />
    </div>
    <n-space vertical :size="12" style="margin-top: 16px">
      <n-h3 v-if="content.title" style="margin: 0">{{ content.title }}</n-h3>
      <n-text v-if="content.description" depth="2">{{
        content.description
      }}</n-text>
      <n-space v-if="content.tags?.length" :size="8">
        <n-tag v-for="tag in content.tags" :key="tag.id" size="small" round>
          {{ tag.name }}
        </n-tag>
      </n-space>
      <n-text v-if="content.shotAt" depth="3" style="font-size: 13px">
        拍摄于 {{ formatDate(content.shotAt) }}
      </n-text>
    </n-space>
  </n-card>
</template>

<script setup lang="ts">
import { NCard, NSpace, NH3, NText, NTag } from 'naive-ui'
import { computed } from 'vue'
import VideoPlayer from '../../../components/VideoPlayer.vue'
import type { VideoPlayback } from '../../../types/media'
import type { VideoVersion } from '../../../api/video'

const props = defineProps<{
  content: {
    playback?: VideoPlayback
    posterUrl?: string
    videoVersions?: VideoVersion[]
    objectKey: string
    sourceUrl?: string
    title?: string
    description?: string
    coverUrl?: string
    shotAt?: string
    createdAt?: string
    tags?: { id: number; name: string }[]
  }
}>()

const videoSources = computed(() => [
  ...(props.content.sourceUrl ? [{ src: props.content.sourceUrl, label: '原画', type: 'video/mp4' }] : []),
  ...(props.content.videoVersions || []).filter(v => v.status === 'done' && v.url).map(v => ({ src: v.url!, label: v.resolution, type: 'video/mp4' }))
])

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}
</script>

<style scoped>
.video-container {
  position: relative;
  width: 100%;
  border-radius: 0;
  overflow: hidden;
  background: #000;
}

.share-video {
  width: 100%;
  display: block;
  max-height: 70vh;
}
</style>

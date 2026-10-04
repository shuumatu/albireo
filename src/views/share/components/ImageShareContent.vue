<template>
  <n-card :bordered="false">
    <div class="image-container">
      <div v-if="failed" class="archive-state" role="status">
        图片暂时无法加载<button
          class="archive-action"
          @click="retry"
        >
          重试
        </button>
      </div>
      <MediaImage :renditions="content.renditions" fit="contain" loading="eager"
        v-else
        :key="attempt"
        @error="failed = true"
        :src="content.displayUrl || content.imageUrl"
        :alt="content.title || '分享图片'"
        class="share-image"
      />
    </div>
    <n-space vertical :size="12" style="margin-top: 16px">
      <n-h3 v-if="content.title" style="margin: 0">{{ content.title }}</n-h3>
      <n-text v-if="content.description" depth="2">{{
        content.description
      }}</n-text>
      <n-text v-if="content.shotAt" depth="3" style="font-size: 13px">
        拍摄于 {{ formatDate(content.shotAt) }}
      </n-text>
    </n-space>
  </n-card>
</template>

<script setup lang="ts">
import type { MediaRendition } from '../../../types/media'
import MediaImage from '../../../components/MediaImage.vue'

import { ref, watch } from 'vue'
const failed = ref(false),
  attempt = ref(0)
function retry() {
  failed.value = false
  attempt.value++
}
import { NCard, NSpace, NH3, NText } from 'naive-ui'
const props = defineProps<{
  content: {
    renditions?: MediaRendition[]
    objectKey: string
    fileName?: string
    imageUrl: string
    displayUrl?: string
    title?: string
    description?: string
    type?: string
    shotAt?: string
    createdAt?: string
  }
}>()

watch(
  () => props.content,
  () => {
    failed.value = false
    attempt.value++
  }
)
function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}
</script>

<style scoped>
.image-container {
  border-radius: 0;
  overflow: hidden;
  background: var(--bg);
  text-align: center;
}

:deep(.share-image) {
  max-width: 100%;
  max-height: 80vh;
  object-fit: contain;
  display: block;
  margin: 0 auto;
}
</style>

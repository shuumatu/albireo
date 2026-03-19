<template>
  <n-card :bordered="false">
    <div class="image-container">
      <img :src="content.imageUrl" :alt="content.title || '分享图片'" class="share-image" />
    </div>
    <n-space vertical :size="12" style="margin-top: 16px">
      <n-h3 v-if="content.title" style="margin: 0">{{ content.title }}</n-h3>
      <n-text v-if="content.description" depth="2">{{ content.description }}</n-text>
      <n-text v-if="content.shotAt" depth="3" style="font-size: 13px">
        拍摄于 {{ formatDate(content.shotAt) }}
      </n-text>
    </n-space>
  </n-card>
</template>

<script setup lang="ts">
defineProps<{
  content: {
    objectKey: string
    fileName?: string
    imageUrl: string
    title?: string
    description?: string
    type?: string
    shotAt?: string
    createdAt?: string
  }
}>()

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric'
  })
}
</script>

<style scoped>
.image-container {
  border-radius: 8px;
  overflow: hidden;
  background: #f0f0f0;
  text-align: center;
}

.share-image {
  max-width: 100%;
  max-height: 80vh;
  object-fit: contain;
  display: block;
  margin: 0 auto;
}
</style>

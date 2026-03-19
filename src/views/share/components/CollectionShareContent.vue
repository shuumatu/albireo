<template>
  <n-card :bordered="false">
    <div v-if="content.imageUrl" class="collection-cover">
      <img :src="content.imageUrl" :alt="content.name" />
    </div>
    <n-space vertical :size="12" style="margin-top: 16px">
      <n-h3 style="margin: 0">{{ content.name }}</n-h3>
      <n-text v-if="content.description" depth="2">{{ content.description }}</n-text>
      <n-text depth="3" style="font-size: 13px">
        创建于 {{ formatDate(content.createdAt) }}
      </n-text>
    </n-space>
  </n-card>
</template>

<script setup lang="ts">
defineProps<{
  content: {
    id: number
    name: string
    description?: string
    createdAt: string
    imageUrl?: string
  }
}>()

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric'
  })
}
</script>

<style scoped>
.collection-cover {
  border-radius: 8px;
  overflow: hidden;
  background: #f0f0f0;
}

.collection-cover img {
  width: 100%;
  max-height: 400px;
  object-fit: cover;
  display: block;
}
</style>

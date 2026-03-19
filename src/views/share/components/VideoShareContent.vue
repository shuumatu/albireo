<template>
  <n-card :bordered="false">
    <div class="video-container">
      <video
        controls
        :poster="content.coverUrl"
        class="share-video"
      >
        <source :src="videoSrc" />
      </video>
    </div>
    <n-space vertical :size="12" style="margin-top: 16px">
      <n-h3 v-if="content.title" style="margin: 0">{{ content.title }}</n-h3>
      <n-text v-if="content.description" depth="2">{{ content.description }}</n-text>
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
import { ref, computed, onMounted } from 'vue'
import { getSystemConfig } from '../../../api/systemConfig'

const props = defineProps<{
  content: {
    objectKey: string
    title?: string
    description?: string
    coverUrl?: string
    shotAt?: string
    createdAt?: string
    tags?: { id: number; name: string }[]
  }
}>()

const customDomain = ref('albireo.shuumatu.com')

onMounted(async () => {
  try {
    const config = await getSystemConfig('storage', 'custom_domain')
    if (config?.value) {
      customDomain.value = config.value
    }
  } catch {
    // fallback to default
  }
})

const videoSrc = computed(() => {
  const domain = customDomain.value.startsWith('http')
    ? customDomain.value
    : `https://${customDomain.value}`
  const key = props.content.objectKey?.startsWith('/')
    ? props.content.objectKey.slice(1)
    : props.content.objectKey
  return `${domain}/${key}`
})

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric'
  })
}
</script>

<style scoped>
.video-container {
  position: relative;
  width: 100%;
  border-radius: 8px;
  overflow: hidden;
  background: #000;
}

.share-video {
  width: 100%;
  display: block;
  max-height: 70vh;
}
</style>

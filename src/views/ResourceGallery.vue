<template>
  <div class="p-6">
    <div class="grid-container">
      <motion-div
        v-for="item in resources"
        :key="item.uuid"
        :initial="{ opacity: 0, scale: 0.95 }"
        :enter="{ opacity: 1, scale: 1 }"
        class="transition-all duration-300 cursor-pointer grid-item"
        @click="goToDetail(item.uuid)"
      >
        <n-card
          :hoverable="true"
          :style="{ borderRadius: '16px', overflow: 'hidden' }"
        >
          <img
            :src="item.coverUrl"
            alt="cover"
            class="w-full object-cover mb-2 rounded"
            style="height: auto; max-height: 200px"
          />
          <div class="text-lg font-semibold line-clamp-1">{{ item.title }}</div>
          <div class="text-gray-500 text-sm line-clamp-2">{{ item.description }}</div>
        </n-card>
      </motion-div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NCard } from 'naive-ui'
import { useRouter } from 'vue-router'


// 模拟资源数据
const resources = Array.from({ length: 20 }, (_, i) => ({
  uuid: `${i + 1}`,
  title: `资源标题 ${i + 1}`,
  description: '这里是一段资源描述，可能是一段视频也可能是一张图片',
  coverUrl: `https://picsum.photos/seed/${i + 1}/300/${150 + (i % 5) * 40}`,
  type: i % 2 === 0 ? 'video' : 'image'
}))

const router = useRouter()
const goToDetail = (uuid: string) => {
  router.push(`/video/${uuid}`)
}
</script>

<style scoped>
.line-clamp-1 {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.grid-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  width: 100%;
  padding: 0;
}

.grid-item {
  break-inside: avoid;
  page-break-inside: avoid;
  transition: transform 0.3s ease;
}

.grid-item:hover {
  transform: translateY(-4px);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .grid-container {
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 12px;
  }
}

@media (max-width: 480px) {
  .grid-container {
    grid-template-columns: 1fr;
    gap: 12px;
  }
}
</style>

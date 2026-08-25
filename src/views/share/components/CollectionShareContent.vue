<template>
  <n-card :bordered="false">
    <!-- 合集封面 -->
    <div v-if="collection.imageUrl" class="collection-cover">
      <img :src="collection.imageUrl" :alt="collection.name" />
    </div>

    <n-space vertical :size="12" style="margin-top: 16px">
      <n-flex align="center" :wrap="false" :size="8">
        <n-h3 style="margin: 0; flex: 1 1 auto;">{{ collection.name }}</n-h3>
        <n-tag size="small" :bordered="false" :type="collectionType === 'image' ? 'success' : 'info'">
          {{ collectionType === 'image' ? '图片合集' : '视频合集' }} · 共 {{ items.length }} 项
        </n-tag>
      </n-flex>
      <n-text v-if="collection.description" depth="2">{{ collection.description }}</n-text>
      <n-text depth="3" style="font-size: 13px">
        创建于 {{ formatDate(collection.createdAt) }}
      </n-text>
    </n-space>

    <!-- 子项网格 -->
    <n-divider v-if="items.length" style="margin: 24px 0 16px;">合集内容</n-divider>

    <div v-if="items.length === 0 && !legacyOnly" class="empty-items">
      <n-empty description="该合集还没有内容" />
    </div>

    <div v-else-if="items.length" class="items-grid" :class="`items-grid--${collectionType}`">
      <div
        v-for="item in items"
        :key="item.id"
        class="item-card"
        :title="`查看${collectionType === 'video' ? '视频' : '图片'}详情`"
        @click="openItem(item)"
      >
        <div class="item-cover">
          <img
            v-if="getThumb(item)"
            :src="getThumb(item)!"
            :alt="getItemTitle(item)"
            loading="lazy"
            @error="onImgError($event)"
          />
          <div v-else class="item-placeholder">
            <span>{{ collectionType === 'video' ? '视频' : '图片' }}</span>
          </div>
          <div v-if="collectionType === 'video'" class="play-overlay">
            <svg viewBox="0 0 24 24" width="36" height="36">
              <circle cx="12" cy="12" r="11" fill="rgba(0,0,0,0.55)" />
              <path d="M10 8l6 4-6 4z" fill="#fff" />
            </svg>
          </div>
        </div>
        <div class="item-title" :title="getItemTitle(item)">{{ getItemTitle(item) }}</div>
      </div>
    </div>
  </n-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  NCard, NSpace, NFlex, NH3, NText, NTag, NDivider, NEmpty
} from 'naive-ui'

/**
 * 合集分享内容兼容两种 content 结构：
 *
 * 1. 新结构（后端 v2）: `{ collection: CollectionWithCoverVO, items: [...], collectionType: 'video' | 'image' }`
 * 2. 旧结构（兼容）   : 直接是 CollectionWithCoverVO，没有 items
 *
 * 老数据不会破，新结构更完整。
 */
const props = defineProps<{
  content: any
}>()

const router = useRouter()

const collection = computed(() => {
  return props.content?.collection ?? props.content
})

const items = computed<any[]>(() => {
  return Array.isArray(props.content?.items) ? props.content.items : []
})

const collectionType = computed<'video' | 'image'>(() => {
  if (props.content?.collectionType) return props.content.collectionType
  // 兜底：有 items 就用 items[0] 推断；都没有按 image 处理（最少破坏）
  const first = items.value[0]
  if (first && 'objectKey' in first && !('imageUrl' in first)) return 'video'
  if (first && 'imageUrl' in first) return 'image'
  return 'image'
})

const legacyOnly = computed(() => !props.content?.items)

function getItemTitle(item: any): string {
  return item?.title || item?.fileName || '未命名'
}

/**
 * 获取缩略图 URL：
 * - 图片：raw 路径替换为 medium
 * - 视频：coverUrl
 */
function getThumb(item: any): string | null {
  if (collectionType.value === 'video') {
    return item?.coverUrl || null
  }
  if (item?.imageUrl) {
    return item.imageUrl.replace(/\/raw\/[^/]+$/, '/medium/medium.jpg')
  }
  return null
}

function onImgError(e: Event) {
  const img = e.target as HTMLImageElement
  // 缩略图加载失败时回退到 raw（图片场景）
  if (img && collectionType.value === 'image' && !img.dataset.fallback) {
    const fallback = img.src.replace(/\/medium\/medium\.jpg$/, '')
    if (fallback !== img.src) {
      img.dataset.fallback = '1'
      img.src = fallback
    }
  }
}

/**
 * 点击合集子项 → 跳转到对应的视频 / 图片详情页。
 *
 * 注意：详情页通常需要登录访问，匿名分享访客点击会被路由守卫推到 Login，
 * 登录后通过 redirect query 回跳到目标详情页。这是产品决策——分享页本身
 * 已经能播放/查看完整内容，详情页提供更丰富的元数据 / 交互。
 */
function openItem(item: any) {
  if (!item?.uuid) return
  if (collectionType.value === 'video') {
    router.push(`/video/${item.uuid}`)
  } else {
    router.push(`/image/${item.uuid}`)
  }
}

function formatDate(dateStr: string) {
  if (!dateStr) return ''
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
  max-height: 360px;
  object-fit: cover;
  display: block;
}

.empty-items {
  padding: 32px 0;
}

/* 子项网格 */
.items-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 14px;
}

.items-grid--video {
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
}

.item-card {
  background: var(--n-card-color, #fff);
  border: 1px solid var(--n-border-color, #e8e8e8);
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.18s, box-shadow 0.18s;
}

.item-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.10);
}

.item-cover {
  position: relative;
  width: 100%;
  background: #0e0e12;
}

.items-grid--image .item-cover {
  aspect-ratio: 1 / 1;
}
.items-grid--video .item-cover {
  aspect-ratio: 16 / 9;
}

.item-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.item-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
}

.play-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  opacity: 0.85;
  transition: opacity 0.18s;
}

.item-card:hover .play-overlay {
  opacity: 1;
}

.item-title {
  padding: 8px 10px;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--n-text-color-1);
}
</style>

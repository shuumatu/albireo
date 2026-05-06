<template>
  <RecommendSection
    title="更多相似内容"
    :subtitle="subtitle"
    :loading="loading"
    :error="error"
    :has-items="items.length > 0"
    empty-text="暂无相似内容（向量还在生成中或未启用）"
    @retry="fetch"
  >
    <div v-for="item in items" :key="`${item.itemType}-${item.id}`" class="card-wrapper">
      <MediaCard :item="item" />
      <!--
        score = cosine similarity（不是百分比相关度）。
        同模态（图↔图）拉到 0.5~0.9 比较常见；跨模态（图↔视频封面其实还是图）也类似。
        阈值低于文本搜索的 0.22/0.30，因为同模态没有 modality gap。
      -->
      <span
        v-if="showScore"
        class="score-badge"
        :class="scoreBadgeClass(item.score)"
        :title="`cosine 相似度 ${item.score.toFixed(3)}`"
      >
        {{ Math.round(item.score * 100) }}%
      </span>
    </div>
  </RecommendSection>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import RecommendSection from './RecommendSection.vue'
import MediaCard from './MediaCard.vue'
import { findSimilar, type SearchItemVO } from '../api/search'

interface Props {
  /** 当前媒体类型 */
  type: 'image' | 'video'
  /** 当前媒体 uuid（来源页 route.params.uuid） */
  uuid: string
  /** 拉取条数，默认 12 */
  limit?: number
  /** 是否在卡片上叠加相似度徽标，调试期默认开启 */
  showScore?: boolean
  /** 副标题，默认走「视觉相似度排序」字样 */
  subtitle?: string
}

const props = withDefaults(defineProps<Props>(), {
  limit: 12,
  showScore: true,
  subtitle: '基于视觉特征自动匹配，跨图片与视频封面'
})

const items = ref<SearchItemVO[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

async function fetch() {
  if (!props.uuid) return
  loading.value = true
  error.value = null
  try {
    items.value = await findSimilar(props.type, props.uuid, props.limit)
  } catch (e: any) {
    console.warn('similar 拉取失败', e)
    error.value = e?.message || '请求失败'
    items.value = []
  } finally {
    loading.value = false
  }
}

/** 同模态 cosine 范围更宽：0.5+ 强相关，0.35+ 中相关 */
function scoreBadgeClass(score: number): string {
  if (score >= 0.5) return 'score-high'
  if (score >= 0.35) return 'score-mid'
  return 'score-low'
}

// uuid 变化时重新拉（同 type 不同 uuid，比如详情页路由内切换）
watch(
  () => [props.type, props.uuid],
  () => fetch(),
  { immediate: true }
)
</script>

<style scoped>
.card-wrapper {
  position: relative;
  flex-shrink: 0;
}

.score-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 2px 8px;
  border-radius: 10px;
  background-color: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  font-size: 11px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.85);
  pointer-events: auto;
  cursor: help;
  border: 1px solid transparent;
}

.score-high {
  color: #58e1a4;
  border-color: rgba(88, 225, 164, 0.4);
}

.score-mid {
  color: #7cb8ff;
  border-color: rgba(124, 184, 255, 0.3);
}

.score-low {
  color: rgba(255, 255, 255, 0.5);
}
</style>

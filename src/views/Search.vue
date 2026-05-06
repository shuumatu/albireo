<template>
  <div class="search-page">
    <!-- 顶部搜索条（独立于全局 header 之外，更醒目，而且支持回车直接搜） -->
    <div class="search-bar">
      <n-input
        v-model:value="localQuery"
        placeholder="试试：海边日落 / 雪山日出 / 城市夜景"
        clearable
        round
        size="large"
        class="big-search"
        @keydown.enter="performSearch"
      >
        <template #prefix>
          <span class="search-icon">🔍</span>
        </template>
      </n-input>
      <n-button
        type="primary"
        size="large"
        :loading="loading"
        :disabled="!localQuery.trim()"
        @click="performSearch"
      >
        搜索
      </n-button>
    </div>

    <!-- 类型筛选 -->
    <div class="filter-bar">
      <n-radio-group v-model:value="typeFilter" size="small" @update:value="onFilterChange">
        <n-radio-button value="all">全部</n-radio-button>
        <n-radio-button value="image">图片</n-radio-button>
        <n-radio-button value="video">视频</n-radio-button>
      </n-radio-group>
      <span v-if="lastQuery && !loading" class="result-meta">
        共 {{ results.length }} 条结果，关键词「{{ lastQuery }}」
      </span>
    </div>

    <!-- 结果区 -->
    <div class="result-area">
      <!-- 加载中骨架 -->
      <div v-if="loading" class="grid">
        <div v-for="n in 12" :key="n" class="skeleton-card">
          <n-skeleton height="180px" :sharp="false" />
          <n-skeleton text :repeat="2" style="margin-top: 8px" />
        </div>
      </div>

      <!-- 错误 -->
      <div v-else-if="error" class="empty-state">
        <p>搜索出错了：{{ error }}</p>
        <n-button @click="performSearch" size="small">重试</n-button>
      </div>

      <!-- 空态：还没搜过 -->
      <div v-else-if="!lastQuery" class="empty-state">
        <p class="hint-title">输入一段描述，按视觉相似度找内容</p>
        <p class="hint-sub">支持中文自然语言，比如「海边日落」「樱花树下」「下雨的街道」</p>
      </div>

      <!-- 空态：搜过但无结果 -->
      <div v-else-if="results.length === 0" class="empty-state">
        <p class="hint-title">没找到与「{{ lastQuery }}」相关的内容</p>
        <p class="hint-sub">试试换个说法、降低相关度阈值，或者等历史回填完成</p>
      </div>

      <!-- 结果网格 -->
      <div v-else class="grid">
        <div
          v-for="item in results"
          :key="`${item.itemType}-${item.id}`"
          class="card-wrapper"
        >
          <MediaCard :item="item" />
          <!--
            相关度徽标。score 是原始 cosine similarity（不是百分制相关度），
            CLIP 的 modality gap 让文本→图像 cosine 几乎只在 [0.10, 0.40]，所以
            30% 在 CLIP 语境下已经是"很相关"。
            徽标颜色按相对分数高亮：top 几张更鲜亮，尾部偏暗，让用户对"该信哪几张"有视觉感知。
          -->
          <span
            class="score-badge"
            :class="scoreBadgeClass(item.score)"
            :title="`cosine 相似度 ${item.score.toFixed(3)}（CLIP 文本-图像通常在 0.1~0.4）`"
          >
            {{ Math.round(item.score * 100) }}%
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MediaCard from '../components/MediaCard.vue'
import { searchByText, type SearchItemVO } from '../api/search'

const route = useRoute()
const router = useRouter()

const localQuery = ref<string>(typeof route.query.q === 'string' ? route.query.q : '')
const lastQuery = ref<string>('')
const loading = ref(false)
const error = ref<string | null>(null)
const results = ref<SearchItemVO[]>([])
const typeFilter = ref<'all' | 'image' | 'video'>('all')

/**
 * 真正发请求。query 从 URL 拿（避免被本地输入双向绑定立刻覆盖），
 * 这样浏览器后退/前进、复制链接分享都能复现搜索结果。
 */
async function runSearch(query: string) {
  if (!query) return
  loading.value = true
  error.value = null
  try {
    const types =
      typeFilter.value === 'all' ? undefined : [typeFilter.value as 'image' | 'video']
    results.value = await searchByText({ query, types, limit: 60 })
    lastQuery.value = query
  } catch (e: any) {
    console.error('search failed', e)
    error.value = e?.message || '请求失败'
    results.value = []
  } finally {
    loading.value = false
  }
}

function performSearch() {
  const q = localQuery.value.trim()
  if (!q) return
  // 推到 URL 上，由 watch(route.query.q) 触发实际搜索；保证可分享/可后退
  router.push({ name: 'Search', query: { q } })
}

function onFilterChange() {
  if (lastQuery.value) {
    runSearch(lastQuery.value)
  }
}

/**
 * 把 cosine score 折算成视觉档位。阈值是按 Chinese-CLIP 文本→图像分布拍的：
 *   ≥ 0.30 强相关（绿）
 *   0.22~0.30 中相关（蓝，默认）
 *   < 0.22 弱相关（灰，前端基本被 minScore=0.22 砍掉，保留兜底）
 */
function scoreBadgeClass(score: number): string {
  if (score >= 0.3) return 'score-high'
  if (score >= 0.22) return 'score-mid'
  return 'score-low'
}

watch(
  () => route.query.q,
  (q) => {
    if (typeof q === 'string' && q.trim()) {
      localQuery.value = q
      runSearch(q.trim())
    } else {
      results.value = []
      lastQuery.value = ''
    }
  }
)

onMounted(() => {
  if (localQuery.value.trim()) {
    runSearch(localQuery.value.trim())
  }
})
</script>

<style scoped>
.search-page {
  min-height: calc(100vh - 64px);
  padding: 32px 48px 64px;
  background-color: #0a0a0a;
  color: #fff;
}

.search-bar {
  display: flex;
  gap: 12px;
  max-width: 760px;
  margin: 0 auto 16px;
}

.big-search {
  flex: 1;
  --n-color: rgba(255, 255, 255, 0.06);
  --n-color-focus: rgba(255, 255, 255, 0.12);
  --n-text-color: white;
  --n-placeholder-color: rgba(255, 255, 255, 0.5);
  --n-border: 1px solid rgba(255, 255, 255, 0.15);
  --n-border-focus: 1px solid rgba(255, 255, 255, 0.4);
}

.search-icon {
  font-size: 16px;
  opacity: 0.6;
  margin-right: 6px;
}

.filter-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  max-width: 760px;
  margin: 0 auto 24px;
}

.result-meta {
  color: rgba(255, 255, 255, 0.5);
  font-size: 13px;
}

.result-area {
  max-width: 1400px;
  margin: 0 auto;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 20px;
}

.card-wrapper {
  position: relative;
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

.skeleton-card {
  background-color: #1a1a1a;
  padding: 8px;
  border-radius: 10px;
}

.empty-state {
  text-align: center;
  padding: 80px 16px;
  color: rgba(255, 255, 255, 0.6);
}

.hint-title {
  font-size: 18px;
  margin-bottom: 8px;
  color: rgba(255, 255, 255, 0.85);
}

.hint-sub {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.5);
}
</style>

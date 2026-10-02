<template>
  <div class="search-page">
    <header class="archive-heading">
      <span class="archive-eyebrow">04 / VISUAL SEARCH</span>
      <h1>寻找脑海中的画面<span>。</span></h1>
      <p>用一句描述，找回记忆中的光线、地点与片刻。</p>
    </header>
    <!-- 顶部搜索条（独立于全局 header 之外，更醒目，而且支持回车直接搜） -->
    <div class="search-bar">
      <n-input
        v-model:value="localQuery"
        placeholder="试试：海边日落 / 雪山日出 / 城市夜景"
        clearable
        size="large"
        class="big-search"
        :input-props="{ 'aria-label': '描述想寻找的画面' }"
        @keydown.enter="performSearch"
      >
        <template #prefix>
          <span class="search-icon" aria-hidden="true">⌕</span>
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
      <n-radio-group
        v-model:value="typeFilter"
        size="small"
        @update:value="onFilterChange"
      >
        <n-radio-button value="all">全部</n-radio-button>
        <n-radio-button value="image">图片</n-radio-button>
        <n-radio-button value="video">视频</n-radio-button>
      </n-radio-group>
      <span v-if="lastQuery && !loading" class="result-meta">
        共 {{ results.length }} 条结果，关键词「{{ lastQuery }}」
      </span>
    </div>

    <!-- 结果区 -->
    <n-alert
      v-if="degraded && !loading && !error"
      type="warning"
      :show-icon="false"
      style="margin-bottom: 16px"
    >
      视觉搜索暂时繁忙或不可用，目前显示标题与描述的关键词匹配结果。
    </n-alert>
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
        <p class="hint-sub">
          支持中文自然语言，比如「海边日落」「樱花树下」「下雨的街道」
        </p>
      </div>

      <!-- 空态：搜过但无结果 -->
      <div v-else-if="results.length === 0" class="empty-state">
        <p class="hint-title">没找到与「{{ lastQuery }}」相关的内容</p>
        <p class="hint-sub">试试其他关键词，或切换图片、视频筛选。</p>
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
            :title="
              item.matchType === 'keyword'
                ? '标题或描述命中关键词'
                : `视觉相似度 ${item.score.toFixed(3)}`
            "
          >
            {{ item.matchType === 'keyword' ? '关键词' : '相近画面' }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  NInput,
  NButton,
  NRadioGroup,
  NRadioButton,
  NAlert,
  NSkeleton
} from 'naive-ui'
import { ref, watch, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MediaCard from '../components/MediaCard.vue'
import { searchByText, type SearchItemVO } from '../api/search'

const route = useRoute()
const router = useRouter()

const localQuery = ref<string>(
  typeof route.query.q === 'string' ? route.query.q : ''
)
const lastQuery = ref<string>('')
const loading = ref(false)
const error = ref<string | null>(null)
const degraded = ref(false)
const results = ref<SearchItemVO[]>([])
const readType = () =>
  route.query.type === 'image' || route.query.type === 'video'
    ? route.query.type
    : 'all'
const typeFilter = ref<'all' | 'image' | 'video'>(readType())
let requestId = 0
async function runSearch(query: string) {
  const id = ++requestId
  if (!query) {
    results.value = []
    lastQuery.value = ''
    error.value = null
    degraded.value = false
    loading.value = false
    return
  }
  loading.value = true
  error.value = null
  lastQuery.value = query
  try {
    const response = await searchByText({
      query,
      types: typeFilter.value === 'all' ? undefined : [typeFilter.value],
      limit: 60
    })
    if (id !== requestId) return
    results.value = response.items
    degraded.value = response.mode === 'keyword_fallback'
  } catch {
    if (id !== requestId) return
    error.value = '连接暂时不可用，请稍后重试'
    results.value = []
  } finally {
    if (id === requestId) loading.value = false
  }
}
function performSearch() {
  const q = localQuery.value.trim()
  if (!q) return
  const query = {
    q,
    ...(typeFilter.value === 'all' ? {} : { type: typeFilter.value })
  }
  if (q === route.query.q && readType() === typeFilter.value) void runSearch(q)
  else router.push({ name: 'Search', query })
}
function onFilterChange() {
  const q = localQuery.value.trim()
  router.push({
    name: 'Search',
    query: {
      ...(q ? { q } : {}),
      ...(typeFilter.value === 'all' ? {} : { type: typeFilter.value })
    }
  })
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
  () => [route.query.q, route.query.type],
  () => {
    localQuery.value = typeof route.query.q === 'string' ? route.query.q : ''
    typeFilter.value = readType()
    void runSearch(localQuery.value.trim())
  },
  { immediate: true }
)
onBeforeUnmount(() => {
  requestId++
})
</script>

<style scoped>
.search-page {
  min-height: calc(100dvh - var(--header-height));
  max-width: 1560px;
  margin: auto;
  padding: 56px 8% 64px;
}
.archive-heading h1 span {
  color: var(--accent);
}
.search-bar {
  display: flex;
  gap: 12px;
  max-width: 800px;
  padding: 12px 0;
  border-bottom: 1px solid var(--accent);
  margin: 28px 0 20px;
}
.big-search {
  flex: 1;
  min-width: 0;
}
.search-icon {
  font-size: 22px;
  color: var(--accent);
}
.filter-bar {
  display: flex;
  align-items: center;
  gap: 18px;
  flex-wrap: wrap;
  margin-bottom: 32px;
}
.result-meta {
  color: var(--muted);
  font-size: 13px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 28px 24px;
}
.card-wrapper {
  position: relative;
  min-width: 0;
}
.card-wrapper :deep(.media-card) {
  width: 100%;
}
.score-badge {
  display: block;
  width: fit-content;
  margin-top: 9px;
  font: 10px var(--mono);
  color: var(--muted);
}
.skeleton-card {
  background: var(--surface);
  padding: 12px;
}
.empty-state {
  padding: 56px 24px;
  border: 1px solid var(--line);
  color: var(--muted);
  text-align: center;
  line-height: 1.8;
}
.hint-title {
  font-size: 18px;
  color: var(--text);
}
.hint-sub {
  font-size: 14px;
}
.hint-sub,
.hint-title {
  margin: 8px 0;
}
@media (max-width: 850px) {
  .grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 600px) {
  .search-page {
    padding: 36px 24px;
  }
  .search-bar {
    gap: 8px;
  }
  .grid {
    gap: 24px 16px;
  }
  .filter-bar {
    gap: 12px;
  }
  .hint-title {
    font-size: 16px;
  }
}
.filter-bar :deep(.n-radio-button){min-height:44px;display:inline-flex;align-items:center}
</style>

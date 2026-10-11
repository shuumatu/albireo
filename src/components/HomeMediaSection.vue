<script setup lang="ts">
import { computed, ref } from 'vue'
import type { RecommendItemVO } from '../api/recommend'
import MediaCard from './MediaCard.vue'
import RecommendSection from './RecommendSection.vue'

const props = withDefaults(defineProps<{
  title: string
  eyebrow: string
  subtitle: string
  items: RecommendItemVO[]
  loading: boolean
  pending: boolean
  refreshing: boolean
  error: string | null
  refreshError: string | null
  emptyText: string
  refreshLabel?: string
}>(), { refreshLabel: '刷新' })
defineEmits<{ refresh: [] }>()

const selectedType = ref<'all' | 'image' | 'video'>('all')
const filters = computed(() => [
  { type: 'all' as const, label: '全部', count: props.items.length },
  { type: 'image' as const, label: '图片', count: props.items.filter(item => item.itemType === 'image').length },
  { type: 'video' as const, label: '视频', count: props.items.filter(item => item.itemType === 'video').length }
])
const visibleItems = computed(() => selectedType.value === 'all'
  ? props.items
  : props.items.filter(item => item.itemType === selectedType.value))
const filteredEmpty = computed(() => props.items.length > 0 && visibleItems.value.length === 0)
</script>

<template>
  <RecommendSection
    :title="title" :eyebrow="eyebrow" :subtitle="subtitle" smooth-drag
    :loading="loading" :error="error" :has-items="visibleItems.length > 0"
    :empty-text="filteredEmpty ? `本组暂无${selectedType === 'video' ? '视频' : '图片'}，可以查看全部或换一组。` : emptyText"
    @retry="$emit('refresh')"
  >
    <template #actions>
      <button class="feed-action" type="button" :disabled="pending" :aria-label="`刷新${title}`" @click="$emit('refresh')">
        {{ refreshing ? '更新中…' : refreshLabel }} <span aria-hidden="true">↻</span>
      </button>
    </template>
    <template #notice>
      <div v-if="items.length && !loading && !error" class="feed-tools">
        <div class="feed-filters" role="group" :aria-label="`${title}类型筛选（仅本组）`">
          <button v-for="filter in filters" :key="filter.type" type="button"
            :aria-pressed="selectedType === filter.type" @click="selectedType = filter.type">
            {{ filter.label }} <span>{{ filter.count }}</span>
          </button>
        </div>
        <span class="feed-count" role="status">本组显示 {{ visibleItems.length }} / {{ items.length }} 件</span>
      </div>
      <p v-if="refreshError" class="feed-notice" role="status">{{ refreshError }}</p>
      <slot name="context" />
    </template>
    <template #empty>
      <button v-if="filteredEmpty" type="button" class="feed-action" @click="selectedType = 'all'">查看本组全部</button>
      <router-link to="/timeline" class="feed-link">去时间线发现影像 ↗</router-link>
    </template>
    <MediaCard v-for="item in visibleItems" :key="`${item.itemType}-${item.id}`" :item="item" />
  </RecommendSection>
</template>

<style scoped>
.feed-tools { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; }
.feed-filters { display: flex; flex-wrap: wrap; gap: 4px; }
.feed-filters button, .feed-action { min-height: 44px; padding: 8px 14px; border: 1px solid var(--line); color: var(--muted); background: transparent; font-size: 13px; }
.feed-filters button { border-color: transparent; }
.feed-filters button span { margin-left: 5px; font: 11px var(--mono); }
.feed-filters button[aria-pressed='true'] { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); }
.feed-filters button:hover, .feed-action:hover:not(:disabled) { color: var(--accent); border-color: var(--accent); }
.feed-action:disabled { opacity: .55; }
.feed-action span { margin-left: 8px; }
.feed-count { color: var(--muted); font-size: 12px; }
.feed-notice { margin: 0 0 16px; padding: 12px 16px; border-left: 2px solid var(--accent-warm); background: var(--accent-warm-soft); color: var(--text); font-size: 13px; }
.feed-link { color: var(--accent); font-size: 13px; min-height: 44px; display: inline-flex; align-items: center; }
@media (max-width: 700px) {
  .feed-filters button { padding-inline: 10px; }
}
</style>

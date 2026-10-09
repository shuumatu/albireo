<template>
  <n-drawer
    :show="show"
    @update:show="(v) => $emit('update:show', v)"
    :width="drawerWidth"
    :placement="viewportWidth < 720 ? 'bottom' : 'right'"
    :height="viewportWidth < 720 ? '60dvh' : undefined"
    :mask-closable="true"
    class="cluster-drawer"
    :to="teleportTarget || 'body'"
  >
    <n-drawer-content
      closable
      :native-scrollbar="false"
      :scrollbar-props="{ onScroll }"
      body-content-style="padding: 14px;"
    >
      <template #header>
        <div class="drawer-header">
          <div class="drawer-title">
            <n-icon :component="LayersOutline" :size="18" />
            <span>{{ totalCount }} 项媒体</span>
          </div>
          <div class="drawer-meta">
            <span v-if="videoCount > 0" class="meta-pill video">
              <n-icon :component="VideocamOutline" :size="13" />
              {{ videoCount }}
            </span>
            <span v-if="imageCount > 0" class="meta-pill image">
              <n-icon :component="ImageOutline" :size="13" />
              {{ imageCount }}
            </span>
          </div>
        </div>
      </template>

      <div class="media-grid" :aria-busy="loading">
        <ClusterMediaCard
          v-for="item in items"
          :key="`${item.mediaType}:${item.uuid}`"
          :item="item"
          :thumbnail-src="thumbResolver(item)"
          @select="$emit('selectMedia', item)"
          @hover="$emit('hoverMedia', $event ? item : null)"
        />
      </div>

      <div ref="loadMoreSentinel" class="load-more-sentinel" aria-hidden="true" />

      <div v-if="error" class="status-row error" role="alert">
        <span>{{ error }}</span>
        <button class="status-button" type="button" :disabled="loading" @click="$emit('retry')">
          重试
        </button>
      </div>
      <div v-else-if="loading" class="status-row" role="status" aria-live="polite">
        <n-spin size="small" />
        <span>{{ items.length === 0 ? '加载中…' : '加载更多…' }}</span>
      </div>
      <div v-else-if="items.length === 0" class="status-row empty" role="status">
        没有可显示的媒体
      </div>
      <div v-else-if="canLoadMore" class="status-row">
        <button class="status-button" type="button" @click="requestLoadMore">加载更多</button>
      </div>
      <div v-else class="status-row end-tip" role="status">
        已到底部 · 已显示 {{ items.length }} 项
      </div>
    </n-drawer-content>
  </n-drawer>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { NDrawer, NDrawerContent, NIcon, NSpin } from 'naive-ui'
import { VideocamOutline, ImageOutline, LayersOutline } from '@vicons/ionicons5'
import type { MapPointVO } from '../../api/map'
import ClusterMediaCard from './ClusterMediaCard.vue'

const props = defineProps<{
  show: boolean
  items: MapPointVO[]
  totalCount: number
  videoCount: number
  imageCount: number
  loading: boolean
  thumbResolver: (item: MapPointVO) => string
  error?: string
  hasMore?: boolean
  teleportTarget?: string | HTMLElement
}>()

const emit = defineEmits<{
  (e: 'update:show', v: boolean): void
  (e: 'hoverMedia', item: MapPointVO | null): void
  (e: 'selectMedia', item: MapPointVO): void
  (e: 'loadMore'): void
  (e: 'retry'): void
}>()

const viewportWidth = ref(typeof window === 'undefined' ? 480 : window.innerWidth)
const drawerWidth = computed(() => Math.min(480, Math.round(viewportWidth.value * 0.9)))
const canLoadMore = computed(() => props.hasMore ?? props.items.length < props.totalCount)
const loadMoreSentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | undefined
let loadMoreRequested = false

function updateViewportWidth() {
  viewportWidth.value = window.innerWidth
}

function requestLoadMore() {
  if (!props.show || props.loading || props.error || !canLoadMore.value || loadMoreRequested) return
  // The observer and scrollbar may report the same boundary in one frame.
  loadMoreRequested = true
  emit('loadMore')
  void nextTick(() => {
    if (!props.loading) loadMoreRequested = false
  })
}

function onScroll(e: Event) {
  const el = e.target as HTMLElement | null
  if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 120) requestLoadMore()
}

function observeSentinel(element: HTMLElement | null, previous?: HTMLElement | null) {
  if (previous) observer?.unobserve(previous)
  if (element) observer?.observe(element)
}

onMounted(() => {
  window.addEventListener('resize', updateViewportWidth)
  // An always visible boundary fills short pages even when there is no scroll event.
  observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.target === loadMoreSentinel.value && entry.isIntersecting)) {
      requestLoadMore()
    }
  }, { rootMargin: '0px 0px 120px 0px' })
  observeSentinel(loadMoreSentinel.value)
})

watch(loadMoreSentinel, observeSentinel, { flush: 'post' })
watch(
  () => [props.show, props.loading, props.error, canLoadMore.value, props.items.length] as const,
  async () => {
    loadMoreRequested = false
    await nextTick()
    // Recheck after layout: appended cards may already have pushed the boundary
    // outside the viewport, so the preceding intersection result is stale.
    observeSentinel(loadMoreSentinel.value, loadMoreSentinel.value)
  },
  { flush: 'post' }
)

onUnmounted(() => {
  window.removeEventListener('resize', updateViewportWidth)
  observer?.disconnect()
})
</script>

<style>
/* Drawer content is teleported; these rules are deliberately global and namespaced. */
.cluster-drawer.n-drawer {
  background: var(--map-glass-bg-strong) !important;
  -webkit-backdrop-filter: var(--map-glass-blur);
  backdrop-filter: var(--map-glass-blur);
  color: var(--map-text-primary);
  border-left: 1px solid var(--map-glass-border);
}

.cluster-drawer .n-drawer-header {
  border-bottom: 1px solid var(--map-glass-border) !important;
  padding: 16px 20px !important;
  background: transparent !important;
}

.cluster-drawer .n-drawer-header__main { width: 100%; }

.cluster-drawer .drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
}

.cluster-drawer .drawer-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: var(--map-count);
  font-variant-numeric: tabular-nums;
}

.cluster-drawer .drawer-meta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.cluster-drawer .meta-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: var(--map-radius-pill);
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  background: var(--surface);
  color: var(--map-text-secondary);
  border: 1px solid var(--map-glass-border);
}

.cluster-drawer .meta-pill.video {
  background: color-mix(in srgb, var(--map-video) 18%, transparent);
  color: var(--map-video);
  border-color: color-mix(in srgb, var(--map-video) 35%, transparent);
}

.cluster-drawer .meta-pill.image {
  background: color-mix(in srgb, var(--map-image) 18%, transparent);
  color: var(--map-image);
  border-color: color-mix(in srgb, var(--map-image) 35%, transparent);
}

.cluster-drawer .n-scrollbar-rail .n-scrollbar-rail__scrollbar {
  background: var(--map-glass-border-strong) !important;
}

.cluster-drawer .media-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 8px;
}

.cluster-drawer .load-more-sentinel { height: 1px; }

.cluster-drawer .status-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 18px 0 6px;
  font-size: 12px;
  color: var(--map-text-tertiary);
}

.cluster-drawer .status-row.error {
  flex-wrap: wrap;
  color: var(--map-text-primary);
  overflow-wrap: anywhere;
  text-align: center;
}

.cluster-drawer .status-row.end-tip,
.cluster-drawer .status-row.empty { padding: 28px 0 6px; }

.cluster-drawer .status-button {
  padding: 6px 14px;
  border: 1px solid var(--map-glass-border-strong);
  border-radius: var(--map-radius-pill);
  background: var(--map-glass-bg-strong);
  color: var(--map-text-primary);
  font: inherit;
  cursor: pointer;
}

.cluster-drawer .status-button:disabled { opacity: 0.6; cursor: wait; }
.cluster-drawer .status-button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
</style>

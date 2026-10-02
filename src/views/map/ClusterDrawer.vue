<template>
  <n-drawer
    :show="show"
    @update:show="(v) => $emit('update:show', v)"
    :width="drawerWidth"
    :placement="viewportWidth < 720 ? 'bottom' : 'right'"
    :height="viewportWidth < 720 ? '60dvh' : undefined"
    :mask-closable="true"
    class="cluster-drawer"
    to="body"
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

      <div class="media-grid">
        <div
          v-for="item in items"
          :key="item.uuid"
          class="media-item"
          role="button"
          tabindex="0"
          @keydown.enter="$emit('selectMedia', item)"
          @keydown.space.prevent="$emit('selectMedia', item)"
          :aria-label="`查看${item.mediaType === 'video' ? '视频' : '图片'}`"
          @mouseenter="$emit('hoverMedia', item)"
          @mouseleave="$emit('hoverMedia', null)"
          @click="$emit('selectMedia', item)"
        >
          <img
            :src="thumbResolver(item)"
            class="media-thumb"
            loading="lazy"
            :alt="item.uuid"
          />
          <div class="media-overlay" />
          <span class="media-type" :class="item.mediaType">
            <n-icon
              :component="
                item.mediaType === 'video' ? VideocamOutline : ImageOutline
              "
              :size="13"
            />
          </span>
        </div>
      </div>

      <div v-if="loading && items.length === 0" class="status-row">
        <n-spin size="small" />
        <span>加载中…</span>
      </div>
      <div v-else-if="items.length === 0" class="status-row empty">
        没有可显示的媒体
      </div>
      <div v-else-if="loading" class="status-row">
        <n-spin size="small" />
        <span>加载更多…</span>
      </div>
      <div v-else-if="items.length >= totalCount" class="status-row end-tip">
        已到底部 · 共 {{ totalCount }} 项
      </div>
    </n-drawer-content>
  </n-drawer>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { NDrawer, NDrawerContent, NIcon, NSpin } from 'naive-ui'
import { VideocamOutline, ImageOutline, LayersOutline } from '@vicons/ionicons5'
import type { MapPointVO } from '../../api/map'

const props = defineProps<{
  show: boolean
  items: MapPointVO[]
  totalCount: number
  videoCount: number
  imageCount: number
  loading: boolean
  thumbResolver: (item: MapPointVO) => string
}>()

const emit = defineEmits<{
  (e: 'update:show', v: boolean): void
  (e: 'hoverMedia', item: MapPointVO | null): void
  (e: 'selectMedia', item: MapPointVO): void
  (e: 'loadMore'): void
}>()

// 抽屉打开后窗口仍可能缩放；宽度必须依赖响应式值才能同步更新。
const viewportWidth = ref(
  typeof window === 'undefined' ? 480 : window.innerWidth
)
function updateViewportWidth() {
  viewportWidth.value = window.innerWidth
}
onMounted(() => window.addEventListener('resize', updateViewportWidth))
onUnmounted(() => window.removeEventListener('resize', updateViewportWidth))

const drawerWidth = computed(() => {
  return Math.min(480, Math.round(viewportWidth.value * 0.9))
})

/**
 * 通过 n-drawer-content 的 scrollbar-props 注入到内部 NScrollbar 的 onScroll。
 * NScrollbar 触发 scroll 时 e.target 是真正的滚动元素，依此判断「滚到底」。
 */
function onScroll(e: Event) {
  if (props.loading) return
  if (props.items.length >= props.totalCount) return
  const el = e.target as HTMLElement
  if (!el) return
  const distance = el.scrollHeight - el.scrollTop - el.clientHeight
  if (distance < 120) {
    emit('loadMore')
  }
}
</script>

<style>
/* n-drawer 会被 teleport 到 body 之外，scoped 选择器追不到，所以走全局样式 */
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

.cluster-drawer .n-drawer-header__main {
  width: 100%;
}

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

/* 内置 NScrollbar 的 rail 样式微调 */
.cluster-drawer .n-scrollbar-rail .n-scrollbar-rail__scrollbar {
  background: var(--map-glass-border-strong) !important;
}

.cluster-drawer .media-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 8px;
}

.cluster-drawer .media-item {
  position: relative;
  aspect-ratio: 1;
  border-radius: var(--map-radius-md);
  overflow: hidden;
  cursor: pointer;
  background: var(--bg);
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.cluster-drawer .media-item:hover {
  transform: translateY(-2px) scale(1.03);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.5);
  z-index: 2;
}

.cluster-drawer .media-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.4s ease;
}

.cluster-drawer .media-item:hover .media-thumb {
  transform: scale(1.08);
}

.cluster-drawer .media-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.55) 0%, transparent 40%);
  opacity: 0;
  transition: opacity 0.2s ease;
}

.cluster-drawer .media-item:hover .media-overlay {
  opacity: 1;
}

.cluster-drawer .media-type {
  position: absolute;
  top: 6px;
  left: 6px;
  width: 22px;
  height: 22px;
  border-radius: 7px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--map-glass-bg-strong);
  color: var(--accent-ink);
  border: 1px solid var(--map-glass-border);
}

.cluster-drawer .media-type.video {
  background: var(--map-video);
}

.cluster-drawer .media-type.image {
  background: var(--map-image);
}

.cluster-drawer .status-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 18px 0 6px;
  font-size: 12px;
  color: var(--map-text-tertiary);
}

.cluster-drawer .status-row.end-tip,
.cluster-drawer .status-row.empty {
  padding: 28px 0 6px;
}
.cluster-drawer .media-item {
  border-radius: 0;
}
.cluster-drawer .media-item:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
</style>

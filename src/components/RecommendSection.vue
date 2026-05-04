<template>
  <section class="recommend-section">
    <header class="section-header">
      <div class="title-block">
        <h2 class="section-title">{{ title }}</h2>
        <p v-if="subtitle" class="section-subtitle">{{ subtitle }}</p>
      </div>
      <div class="scroll-controls" v-if="canScroll">
        <button
          class="scroll-btn"
          :disabled="!canScrollLeft"
          @click="scrollBy(-1)"
          aria-label="向左滚动"
        >
          ‹
        </button>
        <button
          class="scroll-btn"
          :disabled="!canScrollRight"
          @click="scrollBy(1)"
          aria-label="向右滚动"
        >
          ›
        </button>
      </div>
    </header>

    <div class="section-body">
      <!-- 加载中：骨架屏 -->
      <div v-if="loading" class="scroll-rail skeleton-rail">
        <div v-for="n in 6" :key="n" class="skeleton-card">
          <div class="skeleton-thumb"></div>
          <div class="skeleton-line"></div>
          <div class="skeleton-line short"></div>
        </div>
      </div>

      <!-- 错误状态 -->
      <div v-else-if="error" class="section-empty">
        <p>加载失败：{{ error }}</p>
        <button class="retry-btn" @click="$emit('retry')">重试</button>
      </div>

      <!-- 空数据 -->
      <div v-else-if="!hasItems" class="section-empty">
        <p>{{ emptyText || '暂无内容' }}</p>
      </div>

      <!-- 正常数据 -->
      <div v-else ref="rail" class="scroll-rail" @scroll="onScroll">
        <slot></slot>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'

interface Props {
  title: string
  subtitle?: string
  loading?: boolean
  error?: string | null
  emptyText?: string
  /** 是否有数据可展示（外层传入：item 列表的 length > 0） */
  hasItems?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  subtitle: '',
  loading: false,
  error: null,
  emptyText: '',
  hasItems: false
})

defineEmits<{
  (e: 'retry'): void
}>()

const rail = ref<HTMLElement | null>(null)
const canScrollLeft = ref(false)
const canScrollRight = ref(false)
const canScroll = computed(() => canScrollLeft.value || canScrollRight.value)

function updateScrollState() {
  const el = rail.value
  if (!el) {
    canScrollLeft.value = false
    canScrollRight.value = false
    return
  }
  canScrollLeft.value = el.scrollLeft > 4
  canScrollRight.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 4
}

function onScroll() {
  updateScrollState()
}

function scrollBy(direction: -1 | 1) {
  const el = rail.value
  if (!el) return
  const step = Math.max(240, el.clientWidth * 0.8)
  el.scrollBy({ left: direction * step, behavior: 'smooth' })
}

onMounted(() => {
  nextTick(updateScrollState)
})

watch(
  () => [props.loading, props.hasItems],
  () => {
    nextTick(updateScrollState)
  }
)
</script>

<style scoped>
.recommend-section {
  padding: 32px 0;
  color: rgba(255, 255, 255, 0.92);
}

.section-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding: 0 32px 16px;
  gap: 16px;
}

.title-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.section-title {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.section-subtitle {
  margin: 0;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.55);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.scroll-controls {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.scroll-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.25);
  background-color: rgba(255, 255, 255, 0.08);
  color: white;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  transition: background-color 0.2s ease, opacity 0.2s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.scroll-btn:hover:not(:disabled) {
  background-color: rgba(255, 255, 255, 0.18);
}

.scroll-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.section-body {
  position: relative;
}

.scroll-rail {
  display: flex;
  gap: 16px;
  padding: 8px 32px 16px;
  overflow-x: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.15) transparent;
  scroll-snap-type: x proximity;
}

.scroll-rail::-webkit-scrollbar {
  height: 6px;
}

.scroll-rail::-webkit-scrollbar-track {
  background: transparent;
}

.scroll-rail::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
}

.scroll-rail :slotted(*) {
  scroll-snap-align: start;
}

/* 骨架屏 */
.skeleton-card {
  width: 240px;
  flex-shrink: 0;
  border-radius: 10px;
  overflow: hidden;
  background-color: #1a1a1a;
}

.skeleton-thumb {
  width: 100%;
  aspect-ratio: 4 / 3;
  background: linear-gradient(90deg, #1c1c1c 0%, #2a2a2a 50%, #1c1c1c 100%);
  background-size: 200% 100%;
  animation: shimmer 1.4s linear infinite;
}

.skeleton-line {
  height: 12px;
  margin: 12px 12px 0;
  border-radius: 4px;
  background: linear-gradient(90deg, #1c1c1c 0%, #2a2a2a 50%, #1c1c1c 100%);
  background-size: 200% 100%;
  animation: shimmer 1.4s linear infinite;
}

.skeleton-line.short {
  width: 50%;
  margin-bottom: 14px;
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

.section-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 36px 32px;
  color: rgba(255, 255, 255, 0.45);
  font-size: 14px;
  gap: 12px;
}

.retry-btn {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.18);
  color: rgba(255, 255, 255, 0.85);
  padding: 6px 18px;
  border-radius: 16px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.retry-btn:hover {
  background: rgba(255, 255, 255, 0.18);
}

@media (max-width: 768px) {
  .section-header {
    padding: 0 16px 12px;
  }

  .scroll-rail {
    padding: 8px 16px 16px;
  }

  .section-title {
    font-size: 18px;
  }
}
</style>

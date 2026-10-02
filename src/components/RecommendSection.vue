<template>
  <section class="recommend-section">
    <header class="section-header">
      <div class="title-block">
        <span v-if="eyebrow" class="archive-eyebrow">{{ eyebrow }}</span>
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
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue'

interface Props {
  eyebrow?: string
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
  el.scrollBy({
    left: direction * step,
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 'auto'
      : 'smooth'
  })
}

let observer: ResizeObserver | undefined
onMounted(() => {
  observer = new ResizeObserver(updateScrollState)
  if (rail.value) observer.observe(rail.value)
  nextTick(updateScrollState)
})
onBeforeUnmount(() => observer?.disconnect())
watch(rail, (el, old) => {
  if (old) observer?.unobserve(old)
  if (el) observer?.observe(el)
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
  color: var(--text);
  min-width: 0;
}
.section-header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 24px;
}
.title-block {
  position: relative;
  padding-left: 18px;
  min-width: 0;
}
.title-block:before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: linear-gradient(
    var(--accent-warm) 0 12px,
    transparent 12px 17px,
    var(--accent) 17px 24px,
    var(--line) 24px
  );
}
.section-title {
  font-size: 28px;
  letter-spacing: 2px;
  line-height: 1.3;
  margin: 0 0 8px;
}
.section-subtitle {
  font-size: 13px;
  line-height: 1.7;
  color: var(--muted);
  margin: 0;
}
.scroll-controls {
  display: flex;
  gap: 8px;
}
.scroll-btn {
  width: 44px;
  height: 44px;
  border: 1px solid var(--line);
  color: var(--text);
  background: transparent;
  font-size: 24px;
}
.scroll-btn:hover:not(:disabled) {
  color: var(--accent);
  border-color: var(--accent);
}
.scroll-btn:disabled {
  opacity: 0.3;
}
.section-body {
  position: relative;
}
.scroll-rail {
  display: flex;
  gap: 24px;
  padding: 5px 4px 20px;
  overflow-x: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--line) transparent;
  scroll-snap-type: x proximity;
}
.scroll-rail :slotted(*) {
  scroll-snap-align: start;
}
.skeleton-card {
  width: 280px;
  flex-shrink: 0;
  background: var(--surface);
}
.skeleton-thumb {
  aspect-ratio: 4/3;
  background: var(--line);
  opacity: 0.3;
}
.skeleton-line {
  height: 12px;
  margin: 16px;
  background: var(--line);
  opacity: 0.4;
}
.skeleton-line.short {
  width: 50%;
}
.section-empty {
  padding: 44px 24px;
  min-height: 160px;
  border: 1px solid var(--line);
  color: var(--muted);
  font-size: 14px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 12px;
  text-align: center;
}
.section-empty p {
  margin: 0;
}
.retry-btn {
  min-height: 44px;
  padding: 8px 20px;
  background: transparent;
  border: 1px solid var(--line);
  color: var(--text);
}
@media (max-width: 700px) {
  .section-title {
    font-size: 24px;
  }
  .scroll-rail {
    gap: 16px;
  }
  .recommend-section {
    padding: 24px 0;
  }
}
</style>

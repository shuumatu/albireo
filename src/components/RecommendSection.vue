<template>
  <section class="recommend-section" :aria-labelledby="`${sectionId}-title`">
    <header class="section-header">
      <div class="title-block">
        <span v-if="eyebrow" class="archive-eyebrow">{{ eyebrow }}</span>
        <h2 :id="`${sectionId}-title`" class="section-title">{{ title }}</h2>
        <p v-if="subtitle" class="section-subtitle">{{ subtitle }}</p>
      </div>
      <div v-if="$slots.actions || canScroll" class="section-actions">
        <slot name="actions"></slot>
        <div class="scroll-controls" v-if="canScroll">
          <button
            type="button"
            class="scroll-btn"
            :disabled="!canScrollLeft"
            :aria-controls="`${sectionId}-rail`"
            @click="scrollBy(-1)"
            aria-label="向左滚动"
          >
            ‹
          </button>
          <button
            type="button"
            class="scroll-btn"
            :disabled="!canScrollRight"
            :aria-controls="`${sectionId}-rail`"
            @click="scrollBy(1)"
            aria-label="向右滚动"
          >
            ›
          </button>
        </div>
      </div>
    </header>

    <slot name="notice"></slot>

    <span class="sr-only" role="status" aria-live="polite">{{
      loading ? `正在加载${title}…` : !error && !hasItems ? (emptyText || '暂无内容') : ''
    }}</span>

    <div class="section-body" :aria-busy="loading">
      <!-- 加载中：骨架屏 -->
      <div v-if="loading">
        <div class="scroll-rail skeleton-rail" aria-hidden="true">
          <div v-for="n in 6" :key="n" class="skeleton-card">
            <div class="skeleton-thumb"></div>
            <div class="skeleton-line"></div>
            <div class="skeleton-line short"></div>
          </div>
        </div>
      </div>

      <!-- 错误状态 -->
      <div v-else-if="error" class="section-empty">
        <p role="alert">加载失败：{{ error }}</p>
        <button type="button" class="retry-btn" @click="$emit('retry')">重试</button>
      </div>

      <!-- 空数据 -->
      <div v-else-if="!hasItems" class="section-empty">
        <p>{{ emptyText || '暂无内容' }}</p>
        <slot name="empty"></slot>
      </div>

      <!-- 正常数据 -->
      <div
        v-else
        ref="rail"
        :id="`${sectionId}-rail`"
        class="scroll-rail"
        role="group"
        :aria-labelledby="`${sectionId}-title`"
        :tabindex="canScroll ? 0 : undefined"
        :data-albireo-scroll-motion="smoothDrag ? 'smooth' : undefined"
        @scroll="onScroll"
      >
        <slot></slot>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, useId, watch } from 'vue'

interface Props {
  eyebrow?: string
  title: string
  subtitle?: string
  loading?: boolean
  error?: string | null
  emptyText?: string
  /** 是否有数据可展示（外层传入：item 列表的 length > 0） */
  hasItems?: boolean
  /** 连续拖动滚动条时使用缓动，避免逐张吸附。 */
  smoothDrag?: boolean
}

withDefaults(defineProps<Props>(), {
  subtitle: '',
  loading: false,
  error: null,
  emptyText: '',
  hasItems: false,
  smoothDrag: false
})

defineEmits<{
  (e: 'retry'): void
}>()

const rail = ref<HTMLElement | null>(null)
const sectionId = `recommend-${useId()}`
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
let mutationObserver: MutationObserver | undefined
let observedChildren = new Set<Element>()

function observeChildren() {
  const children = new Set(rail.value?.children || [])
  for (const child of observedChildren) {
    if (!children.has(child)) observer?.unobserve(child)
  }
  for (const child of children) {
    if (!observedChildren.has(child)) observer?.observe(child)
  }
  observedChildren = children
  updateScrollState()
}

function observeRail() {
  observer?.disconnect()
  mutationObserver?.disconnect()
  observedChildren.clear()
  if (rail.value) {
    observer?.observe(rail.value)
    mutationObserver?.observe(rail.value, { childList: true })
    observeChildren()
  }
  updateScrollState()
}

onMounted(() => {
  observer = new ResizeObserver(updateScrollState)
  // The rail itself can keep the same width while filtering or resizing cards.
  mutationObserver = new MutationObserver(() => {
    // A new result group starts at its first card; stop any native scrollBy
    // animation before it can carry the new cards toward the previous target.
    rail.value?.scrollTo({ left: 0, behavior: 'instant' })
    observeChildren()
  })
  observeRail()
})
onBeforeUnmount(() => {
  observer?.disconnect()
  mutationObserver?.disconnect()
})
watch(rail, observeRail, { flush: 'post' })
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
.section-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 12px;
  flex-shrink: 0;
  max-width: 100%;
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
  flex-shrink: 0;
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
.scroll-btn:focus-visible,
.retry-btn:focus-visible,
.scroll-rail:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
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
.scroll-rail[data-albireo-scroll-motion='smooth'] {
  /* A scrollbar drag may stop between cards; snapping each update causes jumps. */
  scroll-snap-type: none;
}
.skeleton-card {
  width: min(280px, 100%);
  flex-shrink: 0;
  background: var(--surface);
}
.skeleton-rail {
  /* Loading placeholders have no content to navigate or accessible scrollbar. */
  overflow: hidden;
  scrollbar-width: none;
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
  .section-header {
    align-items: start;
    flex-wrap: wrap;
    gap: 16px;
  }
  .section-actions {
    flex: 1 1 auto;
  }
  .section-title {
    font-size: 24px;
  }
  .scroll-rail {
    gap: 16px;
  }
  .skeleton-card {
    width: min(240px, 100%);
  }
  .recommend-section {
    padding: 24px 0;
  }
}
</style>

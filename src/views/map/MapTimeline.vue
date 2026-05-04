<template>
  <div class="time-axis">
    <div class="timeline-panel glass-panel" :class="{ collapsed }">
      <header class="timeline-header">
        <div class="header-left">
          <div class="header-range">
            {{ formatDate(selectedStartTime) }}
            <span class="range-sep">—</span>
            {{ formatDate(selectedEndTime) }}
          </div>
          <div class="header-sub">
            <n-icon :component="TimeOutline" :size="11" />
            <span>{{ spanLabel }}</span>
            <span v-if="!isFullRange" class="reset-link" @click="resetRange">重置</span>
          </div>
        </div>
        <div class="header-right">
          <div class="header-stats">
            <span v-if="totalVideos > 0" class="stat video">
              <n-icon :component="VideocamOutline" :size="13" />
              {{ totalVideos }}
            </span>
            <span v-if="totalImages > 0" class="stat image">
              <n-icon :component="ImageOutline" :size="13" />
              {{ totalImages }}
            </span>
          </div>
          <button
            class="collapse-btn"
            type="button"
            :aria-label="collapsed ? '展开时间轴' : '收起时间轴'"
            @click="collapsed = !collapsed"
          >
            <n-icon :component="collapsed ? ChevronUp : ChevronDown" :size="16" />
          </button>
        </div>
      </header>

      <div v-show="!collapsed" class="timeline-body">
        <div class="timeline-track-wrap">
          <div class="timeline-track" ref="trackRef">
            <canvas ref="densityCanvas" class="density-canvas" />
            <div
              class="timeline-selection"
              :style="selectionStyle"
              @pointerdown="onSelectionPointerDown"
            >
              <div class="selection-glow" />
            </div>
            <div
              class="timeline-handle"
              :style="startHandleStyle"
              @pointerdown.stop="onStartPointerDown"
            >
              <div class="handle-bar" />
              <div class="handle-grip" />
            </div>
            <div
              class="timeline-handle"
              :style="endHandleStyle"
              @pointerdown.stop="onEndPointerDown"
            >
              <div class="handle-bar" />
              <div class="handle-grip" />
            </div>
          </div>
        </div>

        <div class="timeline-footer">
          <span class="bound left">{{ formatDate(globalMinTime) }}</span>
          <div class="year-marks" :style="{ height: '12px' }">
            <span
              v-for="mark in yearMarks"
              :key="mark.year"
              class="year-mark"
              :style="{ left: mark.left + '%' }"
            >
              <span class="year-tick" />
              <span class="year-label">{{ mark.year }}</span>
            </span>
          </div>
          <span class="bound right">{{ formatDate(globalMaxTime) }}</span>
        </div>
      </div>
    </div>

    <Teleport :to="tooltipTarget">
      <Transition name="tooltip-fade">
        <div
          v-if="dragMode"
          class="handle-tooltip"
          :style="tooltipStyle"
        >
          <div class="tooltip-label">{{ tooltipLabel }}</div>
          <div class="tooltip-time">{{ formatDateFull(tooltipTime) }}</div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { NIcon } from 'naive-ui'
import {
  VideocamOutline,
  ImageOutline,
  TimeOutline,
  ChevronUp,
  ChevronDown,
} from '@vicons/ionicons5'

interface Props {
  globalMinTime: number
  globalMaxTime: number
  rangeStart: number
  rangeEnd: number
  densityBuckets: number[]
  totalVideos: number
  totalImages: number
  /** 拖动 tooltip 的 teleport 宿主：默认 body，全屏模式下父组件会传入地图容器 */
  tooltipTarget?: string | HTMLElement
}

const props = withDefaults(defineProps<Props>(), {
  tooltipTarget: 'body',
})

const emit = defineEmits<{
  (e: 'update:rangeStart', v: number): void
  (e: 'update:rangeEnd', v: number): void
  (e: 'dragStart'): void
  (e: 'dragEnd'): void
}>()

defineExpose({
  /**
   * 数据回填后让父组件触发一次密度图重绘（容器宽度 / DPR 变了也用同一接口）
   */
  redraw: () => nextTick(drawDensity),
})

const trackRef = ref<HTMLDivElement | null>(null)
const densityCanvas = ref<HTMLCanvasElement | null>(null)
const collapsed = ref(false)
const MIN_RANGE = 0.01

const selectedStartTime = computed(() =>
  props.globalMinTime + props.rangeStart * (props.globalMaxTime - props.globalMinTime)
)
const selectedEndTime = computed(() =>
  props.globalMinTime + props.rangeEnd * (props.globalMaxTime - props.globalMinTime)
)
const isFullRange = computed(() => props.rangeStart <= 0 && props.rangeEnd >= 1)

const selectionStyle = computed(() => ({
  left: `${props.rangeStart * 100}%`,
  width: `${(props.rangeEnd - props.rangeStart) * 100}%`,
}))
const startHandleStyle = computed(() => ({
  left: `${props.rangeStart * 100}%`,
}))
const endHandleStyle = computed(() => ({
  left: `${props.rangeEnd * 100}%`,
}))

// --- 时间轴拖拽 ---

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

const dragMode = ref<'start' | 'end' | 'range' | null>(null)
let dragOriginX = 0
let dragOriginStart = 0
let dragOriginEnd = 0

const tooltipX = ref(0)
const tooltipY = ref(0)

function getTrackWidth() {
  return trackRef.value?.getBoundingClientRect().width ?? 1
}

function onStartPointerDown(e: PointerEvent) {
  e.preventDefault()
  dragMode.value = 'start'
  dragOriginX = e.clientX
  dragOriginStart = props.rangeStart
  updateTooltipPos(e)
  document.addEventListener('pointermove', onPointerMove)
  document.addEventListener('pointerup', onPointerUp)
  emit('dragStart')
}

function onEndPointerDown(e: PointerEvent) {
  e.preventDefault()
  dragMode.value = 'end'
  dragOriginX = e.clientX
  dragOriginEnd = props.rangeEnd
  updateTooltipPos(e)
  document.addEventListener('pointermove', onPointerMove)
  document.addEventListener('pointerup', onPointerUp)
  emit('dragStart')
}

function onSelectionPointerDown(e: PointerEvent) {
  e.preventDefault()
  dragMode.value = 'range'
  dragOriginX = e.clientX
  dragOriginStart = props.rangeStart
  dragOriginEnd = props.rangeEnd
  updateTooltipPos(e)
  document.addEventListener('pointermove', onPointerMove)
  document.addEventListener('pointerup', onPointerUp)
  emit('dragStart')
}

function updateTooltipPos(e: PointerEvent) {
  tooltipX.value = e.clientX
  // tooltip 显示在指针正上方 56px 处，给手柄一个明显的"标签头"感
  tooltipY.value = e.clientY - 56
}

function onPointerMove(e: PointerEvent) {
  if (!dragMode.value) return
  updateTooltipPos(e)
  const delta = (e.clientX - dragOriginX) / getTrackWidth()

  if (dragMode.value === 'start') {
    emit('update:rangeStart', clamp(dragOriginStart + delta, 0, props.rangeEnd - MIN_RANGE))
  } else if (dragMode.value === 'end') {
    emit('update:rangeEnd', clamp(dragOriginEnd + delta, props.rangeStart + MIN_RANGE, 1))
  } else {
    const span = dragOriginEnd - dragOriginStart
    let newStart = dragOriginStart + delta
    let newEnd = dragOriginEnd + delta
    if (newStart < 0) {
      newStart = 0
      newEnd = span
    }
    if (newEnd > 1) {
      newEnd = 1
      newStart = 1 - span
    }
    emit('update:rangeStart', newStart)
    emit('update:rangeEnd', newEnd)
  }
}

function onPointerUp() {
  dragMode.value = null
  document.removeEventListener('pointermove', onPointerMove)
  document.removeEventListener('pointerup', onPointerUp)
  emit('dragEnd')
}

function resetRange() {
  emit('update:rangeStart', 0)
  emit('update:rangeEnd', 1)
  emit('dragEnd')
}

// --- tooltip 内容 ---

const tooltipTime = computed(() => {
  if (!dragMode.value) return selectedStartTime.value
  const span = props.globalMaxTime - props.globalMinTime
  if (dragMode.value === 'start') {
    return props.globalMinTime + props.rangeStart * span
  }
  if (dragMode.value === 'end') {
    return props.globalMinTime + props.rangeEnd * span
  }
  // range 模式：显示选中区间的起始时间
  return props.globalMinTime + props.rangeStart * span
})

const tooltipLabel = computed(() => {
  switch (dragMode.value) {
    case 'start': return '开始'
    case 'end': return '结束'
    case 'range': return '区间起'
    default: return ''
  }
})

const tooltipStyle = computed(() => ({
  left: tooltipX.value + 'px',
  top: tooltipY.value + 'px',
}))

// --- 跨度文本 ---

const spanLabel = computed(() => {
  const ms = selectedEndTime.value - selectedStartTime.value
  if (!Number.isFinite(ms) || ms <= 0) return ''
  const days = ms / (1000 * 60 * 60 * 24)
  if (days < 1) {
    const hours = Math.max(1, Math.round(ms / (1000 * 60 * 60)))
    return `跨度 ${hours} 小时`
  }
  if (days < 31) return `跨度 ${Math.round(days)} 天`
  if (days < 366) return `跨度 ${Math.round(days / 30)} 个月`
  return `跨度 ${(days / 365).toFixed(1)} 年`
})

// --- 年份刻度 ---

interface YearMark { year: number; left: number }

const yearMarks = computed<YearMark[]>(() => {
  const span = props.globalMaxTime - props.globalMinTime
  if (!Number.isFinite(span) || span <= 0) return []
  // 跨度小于 365 天不显示年份刻度，按月会更合适但当前不展示
  if (span < 365 * 24 * 60 * 60 * 1000) return []

  const startYear = new Date(props.globalMinTime).getFullYear()
  const endYear = new Date(props.globalMaxTime).getFullYear()
  if (endYear <= startYear) return []

  const totalYears = endYear - startYear
  // 跨度太大的时候只取 N 年间隔，避免标签互相重叠
  const step = totalYears <= 6 ? 1 : totalYears <= 12 ? 2 : Math.ceil(totalYears / 6)

  const marks: YearMark[] = []
  for (let y = startYear + 1; y < endYear; y += step) {
    const ts = new Date(y, 0, 1).getTime()
    const left = ((ts - props.globalMinTime) / span) * 100
    if (left > 4 && left < 96) {
      marks.push({ year: y, left })
    }
  }
  return marks
})

// --- 密度绘制 ---

function drawDensity() {
  const canvas = densityCanvas.value
  const track = trackRef.value
  if (!canvas || !track) return

  const rect = track.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return
  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.round(rect.width * dpr)
  canvas.height = Math.round(rect.height * dpr)

  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, rect.width, rect.height)

  const buckets = props.densityBuckets
  if (buckets.length === 0) return
  const maxCount = Math.max(...buckets)
  if (maxCount === 0) return

  const barW = rect.width / buckets.length
  const baseR = Math.min(2, barW / 2)
  for (let i = 0; i < buckets.length; i++) {
    if (buckets[i] === 0) continue
    const t = buckets[i] / maxCount
    const barH = Math.max(2, t * rect.height)
    const y = rect.height - barH
    // 顶部圆角：用 fill + path roundRect (Chromium 99+ 普及)
    const grad = ctx.createLinearGradient(0, y, 0, rect.height)
    grad.addColorStop(0, `rgba(24, 160, 88, ${(0.55 + t * 0.4).toFixed(3)})`)
    grad.addColorStop(1, `rgba(24, 160, 88, ${(0.18 + t * 0.32).toFixed(3)})`)
    ctx.fillStyle = grad

    if (typeof ctx.roundRect === 'function') {
      ctx.beginPath()
      ctx.roundRect(i * barW, y, Math.max(1, barW - 1), barH, [baseR, baseR, 0, 0])
      ctx.fill()
    } else {
      ctx.fillRect(i * barW, y, Math.max(1, barW - 1), barH)
    }
  }
}

let resizeObserver: ResizeObserver | null = null

watch(() => props.densityBuckets, () => nextTick(drawDensity))
watch(collapsed, () => nextTick(drawDensity))

onMounted(() => {
  nextTick(drawDensity)
  resizeObserver = new ResizeObserver(() => drawDensity())
  if (trackRef.value) resizeObserver.observe(trackRef.value)
})

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  document.removeEventListener('pointermove', onPointerMove)
  document.removeEventListener('pointerup', onPointerUp)
})

// --- 日期格式化 ---

function formatDate(ts: number): string {
  if (!Number.isFinite(ts)) return ''
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function formatDateFull(ts: number): string {
  if (!Number.isFinite(ts)) return ''
  const d = new Date(ts)
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日 周${weekdays[d.getDay()]}`
}
</script>

<style scoped>
@import './mapTokens.css';

.time-axis {
  position: absolute;
  bottom: 12px;
  left: 12px;
  right: 12px;
  z-index: var(--map-z-floating);
  pointer-events: none;
}

.timeline-panel {
  pointer-events: auto;
  padding: 10px 16px 10px;
  border-radius: var(--map-radius-lg);
  transition: padding 0.25s ease;
}

.timeline-panel.collapsed {
  padding: 6px 16px;
}

.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.header-left {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.header-range {
  font-size: 14px;
  color: var(--map-text-primary);
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  letter-spacing: 0.02em;
  user-select: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.range-sep {
  margin: 0 6px;
  color: var(--map-text-tertiary);
  font-weight: 400;
}

.header-sub {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--map-text-tertiary);
  font-variant-numeric: tabular-nums;
  user-select: none;
}

.reset-link {
  cursor: pointer;
  color: var(--map-accent);
  margin-left: 6px;
  padding: 1px 6px;
  border-radius: 4px;
  transition: background 0.15s ease;
}

.reset-link:hover {
  background: var(--map-accent-soft);
}

.header-right {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.header-stats {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.stat {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--map-glass-border);
  border-radius: var(--map-radius-pill);
  font-size: 11px;
  font-weight: 600;
  color: var(--map-text-secondary);
  font-variant-numeric: tabular-nums;
  user-select: none;
}

.stat.video {
  color: color-mix(in srgb, var(--map-video) 60%, #fff 40%);
  background: color-mix(in srgb, var(--map-video) 14%, transparent);
  border-color: color-mix(in srgb, var(--map-video) 30%, transparent);
}

.stat.image {
  color: color-mix(in srgb, var(--map-image) 60%, #fff 40%);
  background: color-mix(in srgb, var(--map-image) 14%, transparent);
  border-color: color-mix(in srgb, var(--map-image) 30%, transparent);
}

.collapse-btn {
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--map-text-tertiary);
  cursor: pointer;
  padding: 0;
  transition: background 0.15s ease, color 0.15s ease;
}

.collapse-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--map-text-primary);
}

.timeline-body {
  margin-top: 8px;
}

.timeline-track-wrap {
  border-radius: var(--map-radius-sm);
  overflow: hidden;
  background: rgba(255, 255, 255, 0.04);
}

.timeline-track {
  position: relative;
  height: 44px;
  user-select: none;
  touch-action: none;
}

.density-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.timeline-selection {
  position: absolute;
  top: 0;
  bottom: 0;
  background: rgba(24, 160, 88, 0.10);
  cursor: grab;
  z-index: 1;
  border-top: 1px solid rgba(24, 160, 88, 0.45);
  border-bottom: 1px solid rgba(24, 160, 88, 0.45);
  transition: background 0.15s ease;
}

.timeline-selection:hover {
  background: rgba(24, 160, 88, 0.18);
}

.timeline-selection:active {
  cursor: grabbing;
  background: rgba(24, 160, 88, 0.24);
}

.selection-glow {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(180deg, transparent 0%, rgba(24, 160, 88, 0.12) 100%);
}

.timeline-handle {
  position: absolute;
  top: -4px;
  bottom: -4px;
  width: 18px;
  transform: translateX(-50%);
  cursor: col-resize;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
}

.handle-bar {
  position: absolute;
  left: 50%;
  top: 0;
  bottom: 0;
  width: 2px;
  transform: translateX(-50%);
  background: #fff;
  border-radius: 1px;
  box-shadow: 0 0 6px rgba(0, 0, 0, 0.6);
  transition: width 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
}

.handle-grip {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 12px;
  height: 24px;
  transform: translate(-50%, -50%);
  background: var(--map-accent);
  border-radius: 4px;
  border: 2px solid #fff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.45);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.timeline-handle:hover .handle-grip,
.timeline-handle:active .handle-grip {
  transform: translate(-50%, -50%) scale(1.12);
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.55), 0 0 0 4px rgba(24, 160, 88, 0.22);
}

.timeline-handle:hover .handle-bar,
.timeline-handle:active .handle-bar {
  background: var(--map-accent);
}

.timeline-footer {
  position: relative;
  display: flex;
  align-items: center;
  margin-top: 6px;
  padding: 0 2px;
  height: 16px;
}

.bound {
  font-size: 10px;
  color: var(--map-text-tertiary);
  font-variant-numeric: tabular-nums;
  user-select: none;
}

.bound.left {
  margin-right: auto;
}

.bound.right {
  margin-left: auto;
}

.year-marks {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  pointer-events: none;
}

.year-mark {
  position: absolute;
  top: 0;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: 9px;
  color: var(--map-text-tertiary);
  font-variant-numeric: tabular-nums;
  opacity: 0.7;
}

.year-tick {
  width: 1px;
  height: 4px;
  background: var(--map-text-tertiary);
  opacity: 0.5;
}

.year-label {
  margin-top: 2px;
}

/* --- 拖动 tooltip --- */
.handle-tooltip {
  position: fixed;
  transform: translateX(-50%);
  pointer-events: none;
  background: rgba(18, 18, 18, 0.92);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
  color: #fff;
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 12px;
  white-space: nowrap;
  z-index: 9999;
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  font-variant-numeric: tabular-nums;
}

.handle-tooltip::after {
  content: '';
  position: absolute;
  bottom: -4px;
  left: 50%;
  transform: translateX(-50%) rotate(45deg);
  width: 8px;
  height: 8px;
  background: rgba(18, 18, 18, 0.92);
  border-right: 1px solid rgba(255, 255, 255, 0.12);
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}

.tooltip-label {
  font-size: 10px;
  color: var(--map-accent);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 600;
}

.tooltip-time {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.tooltip-fade-enter-active,
.tooltip-fade-leave-active {
  transition: opacity 0.12s ease, transform 0.12s ease;
}

.tooltip-fade-enter-from,
.tooltip-fade-leave-to {
  opacity: 0;
  transform: translate(-50%, 4px);
}
</style>

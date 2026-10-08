<script setup lang="ts">
import { computed, nextTick, onActivated, onDeactivated, onMounted, onUnmounted, ref, watch } from 'vue'

interface TimeEntry {
  key: string
  year: number
  month: number
  title: string
  count: number
  loaded: boolean
}
const props = defineProps<{ scroller?: HTMLElement; entries: TimeEntry[] }>()
const selectedKey = defineModel<string>('selectedKey', { default: '' })
const emit = defineEmits<{
  seek: [year: number, month: number]
  dragging: [active: boolean]
  endSpace: [height: number]
  currentDate: [year: number, month: number]
}>()
const slider = ref<HTMLElement>()
const track = ref<HTMLElement>()
const trackHeight = ref(0)
const currentKey = ref('')
const previewPercent = ref(0)
const hovering = ref(false)
const focused = ref(false)
const dragging = ref(false)
const targets = ref(new Map<string, number>())
const weights = ref(new Map<string, number>())
let pendingSelection: { month: string; fraction: number } | undefined
let lastAlignment: { root: HTMLElement; key: string; top: number } | undefined
let pointerId: number | undefined
let frame = 0
let active = false
let connection = 0
let observedScroller: HTMLElement | undefined
const clamp = (value: number) => Math.max(0, Math.min(1, value))
const monthKey = (entry: TimeEntry) => `${entry.year}-${entry.month}`

// As in the original rail, divide rendered row heights between their dates.
// Each date retains its own hit region even when it shares a photo row.
const dates = computed(() => {
  const sizes = props.entries.map(entry => Math.max(1, weights.value.get(entry.key) ?? entry.count * 34))
  const total = sizes.reduce((sum, size) => sum + size, 0)
  let start = 0
  return props.entries.map((entry, index) => {
    const dayStart = start
    start += sizes[index]! / total
    const end = index === props.entries.length - 1 ? 1 : start
    const position = index === 0 ? 0 : index === props.entries.length - 1 ? 1 : (dayStart + end) / 2
    return { ...entry, index, start: dayStart, end, position }
  })
})
type DateStop = (typeof dates.value)[number]
function dateAt(percent: number) {
  return dates.value.find(entry => percent < entry.end) ?? dates.value[dates.value.length - 1]
}
const current = computed(() => dates.value.find(entry => entry.key === (selectedKey.value || currentKey.value)) ?? dates.value[0])
const position = computed(() => current.value?.position ?? 0)
const preview = computed(() => dragging.value || (!hovering.value && focused.value) ? current.value : dateAt(previewPercent.value))
const tooltipTop = computed(() => Math.max(26, Math.min(trackHeight.value - 26, (preview.value?.position ?? 0) * trackHeight.value)))
const markers = computed(() => {
  const months = new Set<string>()
  let previousYear = 0
  const candidates = dates.value.flatMap(entry => {
    const key = monthKey(entry)
    if (months.has(key)) return []
    months.add(key)
    const yearStart = entry.year !== previousYear
    previousYear = entry.year
    return [{ ...entry, yearStart, y: entry.position * trackHeight.value, label: '' as 'year' | 'month' | '' }]
  })
  const labels: number[] = []
  for (const marker of candidates.filter(item => item.yearStart)) {
    if (labels.every(y => Math.abs(y - marker.y) >= 32)) {
      marker.label = 'year'
      labels.push(marker.y)
    }
  }
  for (const marker of candidates.filter(item => !item.yearStart)) {
    if (labels.every(y => Math.abs(y - marker.y) >= 24)) {
      marker.label = 'month'
      labels.push(marker.y)
    }
  }
  return candidates
})

function syncPosition() {
  const root = props.scroller
  if (!root || selectedKey.value) return
  let top = -1
  let key = dates.value[0]?.key ?? ''
  for (const entry of dates.value) {
    const entryTop = targets.value.get(entry.key)
    if (entryTop === undefined || entryTop > root.scrollTop + 1) continue
    if (entryTop > top) { key = entry.key; top = entryTop }
  }
  currentKey.value = key
}
function alignDate(entry: DateStop) {
  const root = props.scroller
  const desiredTop = targets.value.get(entry.key)
  if (!root || desiredTop === undefined) return
  const top = Math.min(desiredTop, Math.max(0, root.scrollHeight - root.clientHeight))
  // Repeated pointer events and resize notifications must not restart a smooth scroll.
  if (lastAlignment?.root === root && lastAlignment.key === entry.key && lastAlignment.top === top) return
  lastAlignment = { root, key: entry.key, top }
  root.scrollTo({
    top,
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
  })
}
function seekDate(entry: DateStop, percent = entry.position) {
  selectedKey.value = entry.key
  currentKey.value = entry.key
  pendingSelection = entry.loaded ? undefined : {
    month: monthKey(entry), fraction: clamp((percent - entry.start) / Math.max(Number.EPSILON, entry.end - entry.start))
  }
  emit('seek', entry.year, entry.month)
  alignDate(entry)
}
function seekPercent(percent: number) {
  const entry = dateAt(percent)
  if (entry) seekDate(entry, percent)
}
async function measure() {
  frame = 0
  const generation = connection
  const root = props.scroller
  const flow = root?.firstElementChild as HTMLElement | undefined
  if (!active || !root || !flow || !track.value) return
  trackHeight.value = track.value.clientHeight
  const positions = new Map<string, number>()
  root.querySelectorAll<HTMLElement>('[data-group]').forEach(element => {
    if (!positions.has(element.dataset.group!)) positions.set(element.dataset.group!, Math.max(0, element.offsetTop - 20))
  })
  targets.value = positions
  const rowWeights = new Map<string, number>()
  const rows = [...flow.querySelectorAll<HTMLElement>('.timeline-row')]
  rows.forEach((row, index) => {
    const fragments = [...row.querySelectorAll<HTMLElement>('[data-group]')]
    const height = ((rows[index + 1]?.offsetTop ?? row.offsetTop + row.offsetHeight) - row.offsetTop) / Math.max(1, fragments.length)
    fragments.forEach(fragment => {
      const key = fragment.dataset.group!
      rowWeights.set(key, (rowWeights.get(key) ?? 0) + height)
    })
  })
  weights.value = rowWeights
  const last = dates.value[dates.value.length - 1]
  const lastTop = last ? positions.get(last.key) ?? 0 : 0
  // The last title can reach the same 20px reading position as every other date.
  const flowBottom = flow.offsetTop + flow.offsetHeight + parseFloat(getComputedStyle(root).paddingBottom)
  emit('endSpace', Math.max(0, Math.ceil(lastTop + root.clientHeight - flowBottom)))
  await nextTick()
  if (!active || generation !== connection) return
  if (selectedKey.value) {
    if (pendingSelection) {
      const days = dates.value.filter(entry => monthKey(entry) === pendingSelection!.month)
      if (days.length && days.every(entry => entry.loaded)) {
        const fraction = days[0]!.start + pendingSelection.fraction * (days[days.length - 1]!.end - days[0]!.start)
        const entry = days.find(day => fraction < day.end) ?? days[days.length - 1]!
        seekDate(entry)
        // The parent applies the v-model update on its next render. Do not
        // invalidate the old placeholder key during that same render cycle.
        return
      }
    }
    const selected = dates.value.find(entry => entry.key === selectedKey.value)
    if (selected) alignDate(selected)
    else if (!pendingSelection) selectedKey.value = ''
  }
  syncPosition()
}
function scheduleMeasure() {
  if (active && !frame) frame = requestAnimationFrame(measure)
}
function pointerPosition(event: PointerEvent) {
  const rect = track.value?.getBoundingClientRect()
  return rect?.height ? clamp((event.clientY - rect.top) / rect.height) : 0
}
function pointerDown(event: PointerEvent) {
  if (!event.isPrimary || event.button !== 0 || !dates.value.length) return
  event.preventDefault()
  slider.value?.focus({ preventScroll: true })
  focused.value = false
  pointerId = event.pointerId
  slider.value?.setPointerCapture(event.pointerId)
  dragging.value = true
  emit('dragging', true)
  previewPercent.value = pointerPosition(event)
  seekPercent(previewPercent.value)
}
function pointerMove(event: PointerEvent) {
  if (pointerId !== undefined && event.pointerId !== pointerId) return
  hovering.value = event.pointerType !== 'touch'
  previewPercent.value = pointerPosition(event)
  if (dragging.value) seekPercent(previewPercent.value)
}
function finishDrag(event?: PointerEvent) {
  if (event && pointerId !== undefined && event.pointerId !== pointerId) return
  const captured = pointerId
  pointerId = undefined
  dragging.value = false
  emit('dragging', false)
  if (captured !== undefined && slider.value?.hasPointerCapture(captured)) slider.value.releasePointerCapture(captured)
  if (event && track.value) {
    const rect = track.value.getBoundingClientRect()
    hovering.value = event.pointerType !== 'touch' && event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom
  }
  syncPosition()
}
function keyDown(event: KeyboardEvent) {
  const index = current.value?.index ?? 0
  const next: Record<string, number> = {
    Home: 0, End: dates.value.length - 1,
    ArrowUp: index - 1, ArrowDown: index + 1,
    ArrowLeft: index - 1, ArrowRight: index + 1,
    PageUp: index - 5, PageDown: index + 5
  }
  if (!(event.key in next)) return
  event.preventDefault()
  focused.value = true
  const entry = dates.value[Math.max(0, Math.min(dates.value.length - 1, next[event.key]!))]
  if (entry) seekDate(entry)
}
function wheel(event: WheelEvent) {
  if (!event.deltaY || dragging.value) return
  const index = current.value?.index ?? 0
  const entry = dates.value[Math.max(0, Math.min(dates.value.length - 1, index + Math.sign(event.deltaY)))]
  if (entry) {
    previewPercent.value = entry.position
    seekDate(entry)
  }
}
const observer = new ResizeObserver(scheduleMeasure)
function disconnect() {
  active = false
  connection++
  finishDrag()
  hovering.value = false
  focused.value = false
  observer.disconnect()
  observedScroller?.removeEventListener('scroll', syncPosition)
  window.removeEventListener('blur', finishOnBlur)
  cancelAnimationFrame(frame)
  frame = 0
  lastAlignment = undefined
}
function finishOnBlur() { finishDrag() }
async function connect() {
  disconnect()
  const generation = connection
  await nextTick()
  if (generation !== connection) return
  active = true
  observedScroller = props.scroller
  observedScroller?.addEventListener('scroll', syncPosition, { passive: true })
  if (observedScroller) {
    observer.observe(observedScroller)
    if (observedScroller.firstElementChild) observer.observe(observedScroller.firstElementChild)
  }
  if (track.value) observer.observe(track.value)
  window.addEventListener('blur', finishOnBlur)
  scheduleMeasure()
}
watch(selectedKey, key => {
  if (!key) {
    pendingSelection = undefined
    lastAlignment = undefined
    syncPosition()
  } else scheduleMeasure()
})
watch(current, entry => {
  if (entry) emit('currentDate', entry.year, entry.month)
}, { immediate: true })
watch(() => props.scroller, connect)
watch(() => props.entries, scheduleMeasure, { flush: 'post' })
onMounted(connect)
onActivated(connect)
onDeactivated(disconnect)
onUnmounted(disconnect)
</script>

<template>
  <aside class="timeline-index" aria-label="时间导航">
    <div ref="slider" class="scrubber" :class="{ 'is-dragging': dragging, 'is-keyboard-focused': focused }"
      role="slider" tabindex="0" aria-label="按时间浏览" aria-orientation="vertical"
      :aria-valuemin="0" :aria-valuemax="Math.max(0, dates.length - 1)" :aria-valuenow="current?.index ?? 0"
      :aria-valuetext="current?.title" :aria-disabled="dates.length <= 1"
      @pointerdown="pointerDown" @pointermove="pointerMove" @pointerleave="hovering = false"
      @pointerup="finishDrag" @pointercancel="finishDrag" @lostpointercapture="finishDrag"
      @focus="focused = true" @blur="focused = false" @keydown="keyDown" @wheel.prevent="wheel">
      <div ref="track" class="scrubber-track">
        <div class="scrubber-progress" :style="{ height: `${position * 100}%` }" aria-hidden="true" />
        <div v-for="entry in dates" :key="entry.key" class="time-segment"
          :data-key="entry.key" :data-start="entry.start" :data-end="entry.end" :data-position="entry.position" :data-loaded="entry.loaded"
          :style="{ top: `${entry.position * 100}%` }" aria-hidden="true">
          <span v-if="entry.index === 0 || (entry.position - dates[entry.index - 1]!.position) * trackHeight >= 3" class="day-tick" />
        </div>
        <div v-for="marker in markers" :key="marker.key" class="time-marker"
          :class="{ 'is-year': marker.yearStart, 'is-current': marker.year === current?.year && marker.month === current?.month }"
          :style="{ top: `${marker.position * 100}%` }" aria-hidden="true">
          <span v-if="marker.label === 'year'" class="year-label">{{ marker.year }}</span>
          <span v-else-if="marker.label === 'month'" class="month-label">{{ String(marker.month).padStart(2, '0') }}月</span>
          <span class="time-tick" />
        </div>
        <div class="scroll-indicator" :data-key="current?.key" :style="{ top: `${position * 100}%` }" aria-hidden="true"><span /></div>
        <div v-if="preview && (hovering || dragging || focused)" class="hover-label" :data-key="preview.key" :style="{ top: `${tooltipTop}px` }">
          <strong>{{ preview.title }}</strong><span>{{ preview.count }} 项{{ !preview.loaded ? ' · 加载后展开日期' : '' }}</span>
        </div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.timeline-index { flex: 0 0 64px; width: 64px; min-height: 0; border-left: 1px solid var(--line); background: var(--bg); z-index: 3; }
.scrubber { height: 100%; position: relative; padding: 12px 0; cursor: ns-resize; touch-action: none; user-select: none; }
.scrubber:focus-visible { outline-offset: -3px; }
.scrubber:focus-visible:not(.is-keyboard-focused) { outline: none; }
.scrubber[aria-disabled='true'] { cursor: default; }
.scrubber-track { position: relative; height: 100%; margin: 0 6px; }
.scrubber-track::before { content: ''; position: absolute; top: 0; bottom: 0; right: 4px; width: 1px; background: var(--line); }
.scrubber-progress { position: absolute; top: 0; right: 4px; width: 1px; background: var(--accent); opacity: .45; }
.time-segment, .time-marker { position: absolute; left: 0; right: 0; height: 0; pointer-events: none; }
.year-label, .month-label { position: absolute; right: 18px; transform: translateY(-50%); font: 10px/18px var(--mono); color: var(--muted); white-space: nowrap; }
.year-label { color: var(--accent-warm); font-size: 11px; font-weight: 600; }
.time-tick, .day-tick { position: absolute; right: 4px; height: 1px; background: var(--line); }
.day-tick { width: 3px; }
.time-tick { width: 7px; background: var(--muted); opacity: .55; }
.is-year .time-tick { width: 11px; background: var(--accent-warm); opacity: .75; }
.is-current .month-label { color: var(--accent); }
.scroll-indicator { position: absolute; right: -2px; width: 19px; height: 2px; transform: translateY(-50%); background: var(--accent); pointer-events: none; }
.scroll-indicator span { position: absolute; right: 4px; top: -2px; width: 6px; height: 6px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
.is-dragging .scroll-indicator span { box-shadow: 0 0 0 5px var(--accent-soft); }
.hover-label { position: absolute; right: calc(100% + 14px); transform: translateY(-50%); display: flex; flex-direction: column; gap: 4px; width: max-content; max-width: min(240px, calc(100vw - 88px)); padding: 9px 12px; border: 1px solid var(--line); border-left: 2px solid var(--accent); background: var(--surface); box-shadow: 0 6px 24px #0003; pointer-events: none; z-index: 4; }
.hover-label strong { font-size: 12px; font-weight: 500; color: var(--text); }
.hover-label span { font: 10px/1.5 var(--mono); color: var(--muted); }
@media (max-width: 700px) {
  .timeline-index { flex-basis: 48px; width: 48px; }
  .scrubber-track { margin: 0 4px; }
  .year-label, .month-label { right: 13px; font-size: 9px; }
  .year-label { font-size: 10px; }
  .is-year .time-tick { width: 8px; }
  .time-tick { width: 5px; }
  .hover-label { right: calc(100% + 10px); }
}
</style>

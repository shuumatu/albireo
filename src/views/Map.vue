<template>
  <div class="map-wrapper">
    <div ref="mapContainer" class="map-container"></div>

    <!-- 图层切换器 -->
    <div class="layer-switcher">
      <label v-for="layer in baseLayers" :key="layer.id">
        <input
          type="radio"
          name="baseLayer"
          :value="layer.id"
          v-model="activeLayer"
          @change="switchLayer(layer.id)"
        />
        {{ layer.name }}
      </label>
    </div>

    <!-- 底部时间轴 -->
    <div class="time-axis">
      <div class="timeline-panel">
        <div class="timeline-header">
          <span class="timeline-selected-range">
            {{ formatDate(selectedStartTime) }} — {{ formatDate(selectedEndTime) }}
          </span>
          <span class="timeline-stats">
            <span v-if="totalVideos > 0">🎬 {{ totalVideos }}</span>
            <span v-if="totalImages > 0">🖼 {{ totalImages }}</span>
          </span>
        </div>
        <div class="timeline-track" ref="trackRef">
          <canvas ref="densityCanvas" class="density-canvas"></canvas>
          <div
            class="timeline-selection"
            :style="selectionStyle"
            @pointerdown="onSelectionPointerDown"
          ></div>
          <div
            class="timeline-handle"
            :style="startHandleStyle"
            @pointerdown.stop="onStartPointerDown"
          ></div>
          <div
            class="timeline-handle"
            :style="endHandleStyle"
            @pointerdown.stop="onEndPointerDown"
          ></div>
        </div>
        <div class="timeline-footer">
          <span class="timeline-bound">{{ formatDate(globalMinTime) }}</span>
          <span class="timeline-bound">{{ formatDate(globalMaxTime) }}</span>
        </div>
      </div>
    </div>

    <!-- 簇内媒体列表弹窗 -->
    <n-modal v-model:show="showClusterPanel" preset="card" style="width: 640px; max-height: 80vh;">
      <template #header>
        簇内媒体（共 {{ clusterMediaTotal }} 项）
      </template>
      <div class="cluster-media-grid">
        <div
          v-for="item in clusterMediaList"
          :key="item.uuid"
          class="cluster-media-item"
          @click="navigateToDetail(item)"
        >
          <img :src="resolveThumbnail(item.objectKey, item.thumbnailUrl, item.mediaType)" class="cluster-media-thumb" />
          <div class="cluster-media-badge">{{ item.mediaType === 'video' ? '🎬' : '🖼' }}</div>
        </div>
      </div>
      <div v-if="clusterMediaTotal > clusterMediaList.length" class="cluster-load-more">
        <n-button size="small" @click="loadMoreClusterMedia">加载更多</n-button>
      </div>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { animate } from 'motion-v'
import { getMapAggregation, getClusterMedia } from '../api/map'
import type { MapPointVO, MapClusterVO } from '../api/map'
import { getSystemConfig } from '../api/systemConfig'
import { gcj02ToWgs84, wgs84ToGcj02 } from '../utils/coordTransform'

const router = useRouter()
const route = useRoute()
const mapContainer = ref<HTMLDivElement | null>(null)
let map: maplibregl.Map | null = null
const activeLayer = ref('protomaps-light')
const customDomain = ref('albireo.shuumatu.com')

/**
 * 从「旅途回忆」卡片跳过来时，URL 带有 ?bboxMinLng&bboxMinLat&bboxMaxLng&bboxMaxLat&start&end，
 * 老链接也兼容 ?lat&lng&start&end。
 * 时间窗口必须等首次聚合返回 globalMinTime/globalMaxTime 后再映射成 rangeStart/rangeEnd，
 * bbox 则在 onMounted 内用 fitBounds 一次性应用。
 * pendingTimeRange 在首次应用后被清空，不影响后续用户操作。
 */
let pendingTimeRange: { start: number; end: number } | null = null
let pendingBbox: [[number, number], [number, number]] | null = null

type BaseLayer =
  | { id: 'osm' | 'satellite'; name: string; type: 'raster' }
  | { id: string; name: string; type: 'vector'; styleUrl: string }

const baseLayers: BaseLayer[] = [
  { id: 'protomaps-light', name: '浅色', type: 'vector', styleUrl: '/map-styles/light.json' },
  { id: 'protomaps-dark', name: '深色', type: 'vector', styleUrl: '/map-styles/dark.json' },
  { id: 'osm', name: '普通地图', type: 'raster' },
  { id: 'satellite', name: '卫星图像', type: 'raster' }
]

const PROTOMAPS_KEY = import.meta.env.VITE_PROTOMAPS_KEY ?? ''

async function loadVectorStyle(url: string): Promise<maplibregl.StyleSpecification> {
  const res = await fetch(url)
  const text = await res.text()
  const filled = text.replace(/__PROTOMAPS_KEY__/g, PROTOMAPS_KEY)
  return JSON.parse(filled) as maplibregl.StyleSpecification
}

const totalVideos = ref(0)
const totalImages = ref(0)

const showClusterPanel = ref(false)
const clusterMediaList = ref<MapPointVO[]>([])
const clusterMediaTotal = ref(0)
let currentClusterId = ''
let currentClusterPage = 1

const trackRef = ref<HTMLDivElement | null>(null)
const densityCanvas = ref<HTMLCanvasElement | null>(null)
const globalMinTime = ref(new Date('2020-01-01').getTime())
const globalMaxTime = ref(Date.now())
const rangeStart = ref(0)
const rangeEnd = ref(1)
const densityBuckets = ref<number[]>([])
const MIN_RANGE = 0.01

const selectedStartTime = computed(() =>
  globalMinTime.value + rangeStart.value * (globalMaxTime.value - globalMinTime.value)
)
const selectedEndTime = computed(() =>
  globalMinTime.value + rangeEnd.value * (globalMaxTime.value - globalMinTime.value)
)
const selectionStyle = computed(() => ({
  left: `${rangeStart.value * 100}%`,
  width: `${(rangeEnd.value - rangeStart.value) * 100}%`,
}))
const startHandleStyle = computed(() => ({
  left: `${rangeStart.value * 100}%`,
}))
const endHandleStyle = computed(() => ({
  left: `${rangeEnd.value * 100}%`,
}))

/**
 * 当前显示在地图上的标记。聚合接口每次返回都会清掉旧的、补上新的，
 * 同时用 motion-v 的 animate() 在新旧之间做「合并 / 分散」过渡：
 *  - 缩放后的新标记从最近旧标记位置 translate 进入
 *  - 旧标记被新标记淘汰时，先飞向最近新标记位置再缩小淡出
 * 记录每个标记当时使用的 lng/lat 是为了在下一帧用 map.project() 重新算屏幕像素位置。
 */
interface MarkerEntry {
  marker: maplibregl.Marker
  motionWrapper: HTMLElement
  lng: number
  lat: number
}
const markerEntries: MarkerEntry[] = []
// 标记从源点 translate 进入 / 飞向目标的最大像素距离，超过则视为「凭空出现 / 直接消失」，避免 pan 时出现长距离飞行
const MOTION_MATCH_PX = 320
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let fetchSeq = 0

// --- 时间工具 ---

function formatDate(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function getTimeParams(): { startDate?: string; endDate?: string } {
  if (rangeStart.value <= 0 && rangeEnd.value >= 1) return {}
  const fmt = (ts: number) => new Date(ts).toISOString().slice(0, 10)
  return {
    startDate: fmt(selectedStartTime.value),
    endDate: fmt(selectedEndTime.value),
  }
}

// --- 时间轴交互 ---

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

let dragMode: 'start' | 'end' | 'range' | null = null
let dragOriginX = 0
let dragOriginStart = 0
let dragOriginEnd = 0

function getTrackWidth() {
  return trackRef.value?.getBoundingClientRect().width ?? 1
}

function onStartPointerDown(e: PointerEvent) {
  e.preventDefault()
  dragMode = 'start'
  dragOriginX = e.clientX
  dragOriginStart = rangeStart.value
  document.addEventListener('pointermove', onPointerMove)
  document.addEventListener('pointerup', onPointerUp)
}

function onEndPointerDown(e: PointerEvent) {
  e.preventDefault()
  dragMode = 'end'
  dragOriginX = e.clientX
  dragOriginEnd = rangeEnd.value
  document.addEventListener('pointermove', onPointerMove)
  document.addEventListener('pointerup', onPointerUp)
}

function onSelectionPointerDown(e: PointerEvent) {
  e.preventDefault()
  dragMode = 'range'
  dragOriginX = e.clientX
  dragOriginStart = rangeStart.value
  dragOriginEnd = rangeEnd.value
  document.addEventListener('pointermove', onPointerMove)
  document.addEventListener('pointerup', onPointerUp)
}

function onPointerMove(e: PointerEvent) {
  if (!dragMode) return
  const delta = (e.clientX - dragOriginX) / getTrackWidth()

  if (dragMode === 'start') {
    rangeStart.value = clamp(dragOriginStart + delta, 0, rangeEnd.value - MIN_RANGE)
  } else if (dragMode === 'end') {
    rangeEnd.value = clamp(dragOriginEnd + delta, rangeStart.value + MIN_RANGE, 1)
  } else {
    const span = dragOriginEnd - dragOriginStart
    let newStart = dragOriginStart + delta
    let newEnd = dragOriginEnd + delta
    if (newStart < 0) { newStart = 0; newEnd = span }
    if (newEnd > 1) { newEnd = 1; newStart = 1 - span }
    rangeStart.value = newStart
    rangeEnd.value = newEnd
  }
}

function onPointerUp() {
  dragMode = null
  document.removeEventListener('pointermove', onPointerMove)
  document.removeEventListener('pointerup', onPointerUp)
  debouncedFetch()
}

// --- 密度绘制 ---

function drawDensity() {
  const canvas = densityCanvas.value
  const track = trackRef.value
  if (!canvas || !track) return

  const rect = track.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.round(rect.width * dpr)
  canvas.height = Math.round(rect.height * dpr)

  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, rect.width, rect.height)

  const buckets = densityBuckets.value
  if (buckets.length === 0) return
  const maxCount = Math.max(...buckets)
  if (maxCount === 0) return

  const barW = rect.width / buckets.length
  for (let i = 0; i < buckets.length; i++) {
    if (buckets[i] === 0) continue
    const t = buckets[i] / maxCount
    ctx.fillStyle = `rgba(34,197,94,${(0.15 + t * 0.7).toFixed(3)})`
    ctx.fillRect(i * barW, 0, Math.ceil(barW), rect.height)
  }
}

function updateTimelineFromAggregation(data: {
  minTime?: string;
  maxTime?: string;
  bucketCount?: number;
  bucketWidthSeconds?: number;
  timeHistogram?: { index: number; start: string; count: number }[];
}) {
  if (data.minTime && data.maxTime) {
    globalMinTime.value = new Date(data.minTime).getTime()
    globalMaxTime.value = new Date(data.maxTime).getTime()
  }
  if (data.timeHistogram) {
    const count = data.bucketCount ?? data.timeHistogram.length
    const bars = new Array<number>(count).fill(0)
    data.timeHistogram.forEach(({ index, count }) => {
      bars[index] = count
    })
    densityBuckets.value = bars
  }
  nextTick(drawDensity)

  // 旅途回忆深链：第一次知道全局时间范围后，把 URL 中的 start/end 映射成 0~1 区间
  if (pendingTimeRange) {
    applyPendingTimeRange()
  }
}

function applyPendingTimeRange() {
  if (!pendingTimeRange) return
  const span = globalMaxTime.value - globalMinTime.value
  if (span <= 0) return

  const s = clamp((pendingTimeRange.start - globalMinTime.value) / span, 0, 1)
  const e = clamp((pendingTimeRange.end - globalMinTime.value) / span, 0, 1)

  pendingTimeRange = null

  if (e - s < MIN_RANGE) return

  rangeStart.value = s
  rangeEnd.value = e
  // 时间窗口缩窄了，重新拉一次聚合数据
  debouncedFetch()
}

let resizeObserver: ResizeObserver | null = null

// --- 经度归一化 ---

function wrapLng(lng: number): number {
  return ((lng % 360) + 540) % 360 - 180
}

function nearestLng(lng: number, referenceLng: number): number {
  const wrapped = wrapLng(lng)
  let best = wrapped
  for (const candidate of [wrapped - 360, wrapped, wrapped + 360]) {
    if (Math.abs(candidate - referenceLng) < Math.abs(best - referenceLng)) {
      best = candidate
    }
  }
  return best
}

function normalizeBounds(bounds: maplibregl.LngLatBounds) {
  let west = bounds.getWest()
  let east = bounds.getEast()
  const south = Math.max(bounds.getSouth(), -90)
  const north = Math.min(bounds.getNorth(), 90)

  if (east - west >= 360) {
    return { minLng: -180, minLat: south, maxLng: 180, maxLat: north }
  }

  west = wrapLng(west)
  east = wrapLng(east)

  if (west > east) {
    return { minLng: -180, minLat: south, maxLng: 180, maxLat: north }
  }

  return { minLng: west, minLat: south, maxLng: east, maxLat: north }
}

/**
 * 把 WGS84 视口 bbox 转成 GCJ02 最小外包矩形。
 * 4 个角各自转换后取 min/max，处理跨国境视口时（境外角点恒等返回）矩形略微膨胀 ~0.006°，
 * 安全地多框入少量境外 WGS84 点，不会漏。
 */
function bboxToGcj02(b: { minLng: number; minLat: number; maxLng: number; maxLat: number }) {
  const corners: Array<[number, number]> = [
    wgs84ToGcj02(b.minLng, b.minLat),
    wgs84ToGcj02(b.minLng, b.maxLat),
    wgs84ToGcj02(b.maxLng, b.minLat),
    wgs84ToGcj02(b.maxLng, b.maxLat),
  ]
  return {
    minLng: Math.min(corners[0][0], corners[1][0], corners[2][0], corners[3][0]),
    minLat: Math.min(corners[0][1], corners[1][1], corners[2][1], corners[3][1]),
    maxLng: Math.max(corners[0][0], corners[1][0], corners[2][0], corners[3][0]),
    maxLat: Math.max(corners[0][1], corners[1][1], corners[2][1], corners[3][1]),
  }
}

// --- 工具函数 ---

function getDomain(): string {
  const d = customDomain.value
  return d.startsWith('http') ? d : `https://${d}`
}

function objectKeyToThumbnail(objectKey: string, mediaType: string): string {
  const domain = getDomain()
  const key = objectKey.startsWith('/') ? objectKey.slice(1) : objectKey

  if (mediaType === 'video') {
    const replaced = key.replace(/\/original\/[^/]*$/, '/thumbnails/thumbnail.jpg')
    return `${domain}/${replaced}`
  }
  const replaced = key.replace(/\/raw\/[^/]+$/, '/medium/medium.jpg')
  return `${domain}/${replaced}`
}

function resolveThumbnail(objectKey: string, thumbnailUrl: string | null, mediaType: string): string {
  if (thumbnailUrl) {
    if (thumbnailUrl.startsWith('http')) return thumbnailUrl
    const domain = getDomain()
    const normalized = thumbnailUrl.startsWith('/') ? thumbnailUrl.slice(1) : thumbnailUrl
    return `${domain}/${normalized}`
  }
  return objectKeyToThumbnail(objectKey, mediaType)
}

// --- 图层切换 ---

function buildRasterStyle(activeId: 'osm' | 'satellite'): maplibregl.StyleSpecification {
  return {
    version: 8,
    sources: {
      osm: {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '&copy; OpenStreetMap contributors'
      },
      satellite: {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        ],
        tileSize: 256,
        attribution: 'Tiles &copy; Esri &amp; the GIS community'
      }
    },
    layers: [
      {
        id: 'osm-layer',
        type: 'raster',
        source: 'osm',
        layout: { visibility: activeId === 'osm' ? 'visible' : 'none' }
      },
      {
        id: 'satellite-layer',
        type: 'raster',
        source: 'satellite',
        layout: { visibility: activeId === 'satellite' ? 'visible' : 'none' }
      }
    ]
  }
}

async function switchLayer(layerId: string) {
  if (!map) return
  const layer = baseLayers.find(l => l.id === layerId)
  if (!layer) return

  if (layer.type === 'vector') {
    const style = await loadVectorStyle(layer.styleUrl)
    map.setStyle(style, { diff: false })
  } else {
    map.setStyle(buildRasterStyle(layer.id), { diff: false })
  }

  map.once('idle', () => {
    fetchAggregation()
  })
}

// --- 标记管理 ---

function clearMarkers() {
  markerEntries.forEach(e => e.marker.remove())
  markerEntries.length = 0
}

/**
 * marker DOM 结构：
 *   .marker-anchor          ← 由 MapLibre 直接 transform 定位，禁止挂自己的 transform/transition
 *     .marker-motion-wrapper ← motion-v animate() 的目标，独占 transform/opacity，不写 hover 样式
 *       .cluster-marker-inner / .point-marker-inner ← 视觉容器，hover 缩放在这里
 * 三层分离避免 motion 的 WAAPI 把 hover 的 transform 覆盖掉。
 */
function createClusterMarkerElement(cluster: MapClusterVO): { el: HTMLDivElement; motionWrapper: HTMLDivElement } {
  const el = document.createElement('div')
  el.className = 'marker-anchor'

  const size = Math.min(96, Math.max(56, 56 + Math.log2(cluster.count) * 8))
  el.style.width = `${size}px`
  el.style.height = `${size}px`

  const thumbUrl = resolveThumbnail(
    cluster.representativeObjectKey,
    cluster.representativeThumbnailUrl,
    cluster.representativeMediaType
  )

  el.innerHTML = `
    <div class="marker-motion-wrapper">
      <div class="cluster-marker-inner">
        <img src="${thumbUrl}" class="cluster-thumb" alt="" />
        <span class="cluster-count">${cluster.count}</span>
      </div>
    </div>
  `
  const motionWrapper = el.querySelector('.marker-motion-wrapper') as HTMLDivElement
  return { el, motionWrapper }
}

function createPointMarkerElement(point: MapPointVO): { el: HTMLDivElement; motionWrapper: HTMLDivElement } {
  const el = document.createElement('div')
  el.className = 'marker-anchor'
  el.style.width = '60px'
  el.style.height = '60px'

  const thumbUrl = resolveThumbnail(point.objectKey, point.thumbnailUrl, point.mediaType)

  el.innerHTML = `
    <div class="marker-motion-wrapper">
      <div class="point-marker-inner">
        <img src="${thumbUrl}" class="point-thumb" alt="" />
        <span class="point-type-badge">${point.mediaType === 'video' ? '🎬' : '🖼'}</span>
      </div>
    </div>
  `
  const motionWrapper = el.querySelector('.marker-motion-wrapper') as HTMLDivElement
  return { el, motionWrapper }
}

// --- 动画辅助 ---

interface PixelPos { x: number; y: number }
interface OldEntrySnapshot extends PixelPos { entry: MarkerEntry }

function projectLngLat(lng: number, lat: number): PixelPos | null {
  if (!map) return null
  const p = map.project([lng, lat])
  return { x: p.x, y: p.y }
}

/** 在 snapshots 中找出离 px 最近的一个（限制最大距离），返回到该点的 (dx, dy) 偏移。 */
function findNearestDelta(
  px: PixelPos,
  snapshots: PixelPos[],
  maxDist: number,
): { dx: number; dy: number } | null {
  let best: PixelPos | null = null
  let bestD = maxDist
  for (const s of snapshots) {
    const dx = s.x - px.x
    const dy = s.y - px.y
    const d = Math.hypot(dx, dy)
    if (d < bestD) {
      bestD = d
      best = s
    }
  }
  if (!best) return null
  return { dx: best.x - px.x, dy: best.y - px.y }
}

// 距离 ≤ IN_PLACE_PX 时认为新旧两组在同一像素位置（典型 pan 场景：lng/lat 复用），跳过动画避免闪烁
const IN_PLACE_PX = 4

/**
 * 从 (dx, dy) 偏移位置 translate 到原位，伴随 scale/opacity，模拟「分散」效果。
 * - src 为 null（找不到合适的源点）：简单 scale + fade-in
 * - 偏移很小（pan 场景同位置）：完全跳过动画
 */
function animateMarkerIn(target: HTMLElement, src: { dx: number; dy: number } | null) {
  if (!src) {
    animate(
      target,
      { scale: [0.7, 1], opacity: [0, 1] },
      { duration: 0.25, ease: [0.22, 1, 0.36, 1] },
    )
    return
  }
  const distance = Math.hypot(src.dx, src.dy)
  if (distance <= IN_PLACE_PX) return
  animate(
    target,
    { x: [src.dx, 0], y: [src.dy, 0], scale: [0.55, 1], opacity: [0, 1] },
    { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  )
}

/**
 * 飞向 (dx, dy) 偏移位置，同时缩小、淡出，结束后 remove marker，模拟「合并」效果。
 * - dst 为 null 时退化为原地缩小淡出
 * - 偏移很小（pan 场景同位置已有新标记接管）：直接 remove，避免闪烁
 */
function animateMarkerOutAndRemove(entry: MarkerEntry, dst: { dx: number; dy: number } | null) {
  if (dst && Math.hypot(dst.dx, dst.dy) <= IN_PLACE_PX) {
    entry.marker.remove()
    return
  }
  const target = entry.motionWrapper
  // 让淡出的旧标记落在新标记之下，避免在汇聚瞬间盖住新出现的簇
  target.style.zIndex = '0'
  const targetState = dst
    ? { x: dst.dx, y: dst.dy, scale: 0.4, opacity: 0 }
    : { scale: 0.5, opacity: 0 }
  const controls = animate(target, targetState, { duration: 0.35, ease: [0.4, 0, 1, 1] })
  controls.then(() => entry.marker.remove()).catch(() => entry.marker.remove())
}

function renderClusters(
  clusters: MapClusterVO[],
  oldSnapshots: OldEntrySnapshot[],
  newSnapshotsOut: PixelPos[],
) {
  const centerLng = map!.getCenter().lng
  clusters.forEach(cluster => {
    const { el, motionWrapper } = createClusterMarkerElement(cluster)
    const [tLng, tLat] = gcj02ToWgs84(cluster.longitude, cluster.latitude)
    const lng = nearestLng(tLng, centerLng)
    const marker = new maplibregl.Marker({ element: el })
      .setLngLat([lng, tLat])
      .addTo(map!)

    el.addEventListener('click', () => openClusterMedia(cluster.clusterId))
    markerEntries.push({ marker, motionWrapper, lng, lat: tLat })

    const px = projectLngLat(lng, tLat)
    if (px) {
      // 「合并」：多个旧点 → 新簇。让新簇从最近的旧标记位置升起。
      const src = findNearestDelta(px, oldSnapshots, MOTION_MATCH_PX)
      animateMarkerIn(motionWrapper, src)
      newSnapshotsOut.push(px)
    } else {
      animateMarkerIn(motionWrapper, null)
    }
  })
}

function renderPoints(
  points: MapPointVO[],
  oldSnapshots: OldEntrySnapshot[],
  newSnapshotsOut: PixelPos[],
) {
  const centerLng = map!.getCenter().lng
  points.forEach(point => {
    const { el, motionWrapper } = createPointMarkerElement(point)
    const [tLng, tLat] = gcj02ToWgs84(point.longitude, point.latitude)
    const lng = nearestLng(tLng, centerLng)
    const marker = new maplibregl.Marker({ element: el })
      .setLngLat([lng, tLat])
      .addTo(map!)

    el.addEventListener('click', () => navigateToDetail(point))
    markerEntries.push({ marker, motionWrapper, lng, lat: tLat })

    const px = projectLngLat(lng, tLat)
    if (px) {
      // 「分散」：旧簇 → 多个新点。让每个新点从最近的旧簇位置飞出来。
      const src = findNearestDelta(px, oldSnapshots, MOTION_MATCH_PX)
      animateMarkerIn(motionWrapper, src)
      newSnapshotsOut.push(px)
    } else {
      animateMarkerIn(motionWrapper, null)
    }
  })
}

// --- 数据加载 ---

async function fetchAggregation() {
  if (!map) return
  const seq = ++fetchSeq
  const wgsBounds = normalizeBounds(map.getBounds())
  // 中国境内的国行设备 EXIF GPS 实际是 GCJ02，DB geom 数值也就是 GCJ02。
  // 把视口 4 个角各自转成 GCJ02 后取最小外包矩形，再发给后端，避免 ~500m 系统性偏差导致的漏点 / 计数对不上。
  // 4 角法可以兼顾横跨国境的视口（境外角点恒等返回 WGS84，矩形会略微膨胀 ~0.006°，最多多框入几个境外点，不会漏）。
  const bounds = bboxToGcj02(wgsBounds)
  const zoom = Math.round(map.getZoom())

  try {
    const data = await getMapAggregation({ ...bounds, zoom, ...getTimeParams() })

    if (seq !== fetchSeq) return

    totalVideos.value = data.totalVideos
    totalImages.value = data.totalImages
    updateTimelineFromAggregation(data)

    // 摘下旧 entries，留给后面做出场动画；新渲染会重新填充 markerEntries
    const oldEntries = markerEntries.splice(0, markerEntries.length)
    const oldSnapshots: OldEntrySnapshot[] = []
    for (const e of oldEntries) {
      const p = projectLngLat(e.lng, e.lat)
      if (p) oldSnapshots.push({ ...p, entry: e })
    }

    const newSnapshots: PixelPos[] = []
    if (data.clusters.length > 0) {
      renderClusters(data.clusters, oldSnapshots, newSnapshots)
    }
    if (data.points.length > 0) {
      renderPoints(data.points, oldSnapshots, newSnapshots)
    }

    // 没有新标记时直接 remove 旧标记，避免旧标记孤零零地原地缩小
    if (newSnapshots.length === 0) {
      oldEntries.forEach(e => e.marker.remove())
    } else {
      for (const snap of oldSnapshots) {
        const dst = findNearestDelta(snap, newSnapshots, MOTION_MATCH_PX)
        animateMarkerOutAndRemove(snap.entry, dst)
      }
    }
  } catch (e) {
    if (seq !== fetchSeq) return
    console.error('地图聚合请求失败', e)
  }
}

function debouncedFetch() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(fetchAggregation, 400)
}

// --- 簇内媒体 ---

async function openClusterMedia(clusterId: string) {
  currentClusterId = clusterId
  currentClusterPage = 1
  clusterMediaList.value = []
  clusterMediaTotal.value = 0
  showClusterPanel.value = true

  try {
    const res = await getClusterMedia(clusterId, 1, 20)
    clusterMediaList.value = res.data
    clusterMediaTotal.value = res.total
  } catch (e) {
    console.error('获取簇内媒体失败', e)
  }
}

async function loadMoreClusterMedia() {
  currentClusterPage++
  try {
    const res = await getClusterMedia(currentClusterId, currentClusterPage, 20)
    clusterMediaList.value.push(...res.data)
  } catch (e) {
    console.error('加载更多失败', e)
  }
}

// --- 导航 ---

function navigateToDetail(point: MapPointVO) {
  const routeLocation = point.mediaType === 'video'
    ? { name: 'VideoPlayer', params: { uuid: point.uuid } }
    : { name: 'ImageDetail', params: { uuid: point.uuid } }

  const resolved = router.resolve(routeLocation)
  window.open(resolved.href, '_blank', 'noopener')
}

// --- 生命周期 ---

onMounted(async () => {
  const domainConfig = await getSystemConfig('storage', 'custom_domain').catch(() => null)
  if (domainConfig?.value) {
    customDomain.value = domainConfig.value
  }

  const initialStyle = await loadVectorStyle('/map-styles/light.json')

  // 解析「从旅途卡片跳过来」的 query 参数：bbox 优先，否则 lat/lng；time 暂存到 pendingTimeRange
  const initialView = resolveInitialView()

  map = new maplibregl.Map({
    container: mapContainer.value!,
    style: initialStyle,
    center: initialView.center,
    zoom: initialView.zoom
  })

  map.on('load', () => {
    // bbox 跳转：等地图 load 完用 fitBounds 让媒体范围居中。
    // - padding 留出周围少量上下文，bottom 给时间轴让位避免遮挡；
    // - maxZoom=13 限制小 bbox（如一次城市内旅游）的最高 zoom，避免放大到只看见几个街区。
    if (pendingBbox && map) {
      map.fitBounds(pendingBbox, {
        padding: { top: 80, bottom: 160, left: 80, right: 80 },
        duration: 0,
        maxZoom: 13,
      })
      pendingBbox = null
    }
    fetchAggregation()
  })

  map.on('moveend', fetchAggregation)

  resizeObserver = new ResizeObserver(drawDensity)
  if (trackRef.value) resizeObserver.observe(trackRef.value)
})

/**
 * 根据 URL query 决定地图初始中心 / 缩放，并把 bbox / 时间范围暂存以备 load / 首次聚合后应用。
 * 优先级：bbox > lat/lng > 默认（北京，zoom 5）。
 */
function resolveInitialView(): { center: [number, number]; zoom: number } {
  const defaultView = { center: [116.4074, 39.9042] as [number, number], zoom: 5 }
  let center = defaultView.center
  let zoom = defaultView.zoom

  // 1) bbox 模式（旅途卡片新链接）
  const bbox = parseBboxQuery()
  if (bbox) {
    // 国行设备 EXIF GPS 实际是 GCJ02，DB geom 数值就是 GCJ02。
    // 旅途接口的 bbox = ST_Extent(geom)，所以也是 GCJ02 数值。
    // fitBounds 接收的是地图坐标（WGS84），需要把两个角点先转回 WGS84。
    const [swLng, swLat] = gcj02ToWgs84(bbox[0][0], bbox[0][1])
    const [neLng, neLat] = gcj02ToWgs84(bbox[1][0], bbox[1][1])
    pendingBbox = [[swLng, swLat], [neLng, neLat]]
    // 先把 center 设到 bbox 中心，避免地图初始化短暂闪过北京；fitBounds 在 load 后再精确收紧
    center = [(swLng + neLng) / 2, (swLat + neLat) / 2]
    zoom = 8
  } else {
    // 2) lat/lng 模式（向后兼容）
    const lat = parseFloat(String(route.query.lat ?? ''))
    const lng = parseFloat(String(route.query.lng ?? ''))
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      const [wgsLng, wgsLat] = gcj02ToWgs84(lng, lat)
      center = [wgsLng, wgsLat]
      zoom = 11
    }
  }

  // 3) 时间窗口：精确使用 trip 的 MIN/MAX shot_at，不再加 buffer，确保计数与卡片一致
  const startRaw = route.query.start
  const endRaw = route.query.end
  if (typeof startRaw === 'string' && typeof endRaw === 'string') {
    const startTs = new Date(startRaw).getTime()
    const endTs = new Date(endRaw).getTime()
    if (Number.isFinite(startTs) && Number.isFinite(endTs) && endTs > startTs) {
      pendingTimeRange = { start: startTs, end: endTs }
    }
  }

  return { center, zoom }
}

/** 解析 ?bboxMinLng&bboxMinLat&bboxMaxLng&bboxMaxLat → [[minLng,minLat],[maxLng,maxLat]] (GCJ02) */
function parseBboxQuery(): [[number, number], [number, number]] | null {
  const minLng = parseFloat(String(route.query.bboxMinLng ?? ''))
  const minLat = parseFloat(String(route.query.bboxMinLat ?? ''))
  const maxLng = parseFloat(String(route.query.bboxMaxLng ?? ''))
  const maxLat = parseFloat(String(route.query.bboxMaxLat ?? ''))
  if (![minLng, minLat, maxLng, maxLat].every(Number.isFinite)) return null
  if (minLng >= maxLng || minLat >= maxLat) return null
  if (minLng < -180 || maxLng > 180 || minLat < -90 || maxLat > 90) return null
  return [[minLng, minLat], [maxLng, maxLat]]
}

onUnmounted(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
  clearMarkers()
  if (map) {
    map.remove()
    map = null
  }
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  document.removeEventListener('pointermove', onPointerMove)
  document.removeEventListener('pointerup', onPointerUp)
})
</script>

<style>
.map-wrapper {
  height: 100%;
  width: 100%;
  position: relative;
}

.map-container {
  height: 100%;
  width: 100%;
}

.layer-switcher {
  position: absolute;
  top: 10px;
  right: 10px;
  background: white;
  padding: 10px 12px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  min-width: 130px;
}

.layer-switcher label {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  white-space: nowrap;
}

.time-axis {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 1;
  padding: 12px 20px;
  pointer-events: none;
}

.timeline-panel {
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-radius: 14px;
  padding: 10px 16px 8px;
  pointer-events: auto;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.25);
}

.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.timeline-selected-range {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.9);
  font-variant-numeric: tabular-nums;
  user-select: none;
  letter-spacing: 0.02em;
}

.timeline-stats {
  display: flex;
  gap: 10px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.75);
  user-select: none;
}

.timeline-track {
  position: relative;
  height: 32px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 6px;
  overflow: hidden;
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
  background: rgba(255, 255, 255, 0.10);
  cursor: grab;
  z-index: 1;
  border-top: 1px solid rgba(255, 255, 255, 0.18);
  border-bottom: 1px solid rgba(255, 255, 255, 0.18);
  transition: background 0.1s;
}

.timeline-selection:hover {
  background: rgba(255, 255, 255, 0.15);
}

.timeline-selection:active {
  cursor: grabbing;
  background: rgba(255, 255, 255, 0.18);
}

.timeline-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 16px;
  transform: translateX(-50%);
  cursor: col-resize;
  z-index: 2;
}

.timeline-handle::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 0;
  bottom: 0;
  width: 2px;
  transform: translateX(-50%);
  background: rgba(255, 255, 255, 0.85);
  border-radius: 1px;
  box-shadow: 0 0 6px rgba(0, 0, 0, 0.5);
  transition: width 0.15s, background 0.15s, box-shadow 0.15s;
}

.timeline-handle:hover::before,
.timeline-handle:active::before {
  width: 3px;
  background: #fff;
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.3), 0 0 4px rgba(0, 0, 0, 0.5);
}

.timeline-footer {
  display: flex;
  justify-content: space-between;
  margin-top: 4px;
}

.timeline-bound {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);
  font-variant-numeric: tabular-nums;
  user-select: none;
}

/* ---- 标记锚点（MapLibre 直接控制此元素的 transform，不要在这里加 transition/transform） ---- */
.marker-anchor {
  cursor: pointer;
}

/* ---- motion 包裹层：motion-v 的 animate() 独占这一层的 transform/opacity ----
   不要在这层写 hover、transition，避免和 WAAPI 抢同一属性；hover 的视觉缩放放在内层。 */
.marker-motion-wrapper {
  width: 100%;
  height: 100%;
  transform-origin: 50% 50%;
  will-change: transform, opacity;
}

/* ---- 聚合簇标记 ---- */
.cluster-marker-inner {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 8px;
  overflow: hidden;
  border: 3px solid rgba(255, 255, 255, 0.9);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  box-sizing: border-box;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.marker-anchor:hover .cluster-marker-inner {
  transform: scale(1.12);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  z-index: 10;
}

.cluster-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.cluster-count {
  position: absolute;
  bottom: 0;
  right: 0;
  background: #18a058;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  min-width: 20px;
  height: 20px;
  line-height: 20px;
  text-align: center;
  border-radius: 10px;
  padding: 0 5px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

/* ---- 单点标记 ---- */
.point-marker-inner {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid rgba(255, 255, 255, 0.9);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
  box-sizing: border-box;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.marker-anchor:hover .point-marker-inner {
  transform: scale(1.1);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.35);
  z-index: 10;
}

.point-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.point-type-badge {
  position: absolute;
  top: 2px;
  left: 2px;
  font-size: 12px;
  line-height: 1;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 4px;
  padding: 2px 3px;
}

/* ---- 簇内媒体弹窗 ---- */
.cluster-media-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 8px;
  max-height: 60vh;
  overflow-y: auto;
  padding: 4px;
}

.cluster-media-item {
  position: relative;
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.15s ease;
}

.cluster-media-item:hover {
  transform: scale(1.04);
}

.cluster-media-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.cluster-media-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  font-size: 14px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 4px;
  padding: 2px 4px;
  line-height: 1;
}

.cluster-load-more {
  text-align: center;
  padding: 12px 0 4px;
}
</style>
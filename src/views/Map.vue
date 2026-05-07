<template>
  <div class="map-wrapper" ref="wrapperRef" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
    <MapSidebar
      :entries="filteredEntries"
      :hovered-id="hoveredEntryId"
      :collapsed="sidebarCollapsed"
      :zoom="currentZoom"
      :filter="entryFilter"
      :total-videos="totalVideos"
      :total-images="totalImages"
      @hover-entry="onHoverEntry"
      @select-entry="onSelectEntry"
      @update:filter="entryFilter = $event"
    />

    <button
      class="sidebar-handle glass-panel"
      type="button"
      :aria-label="sidebarCollapsed ? '展开侧栏' : '收起侧栏'"
      :title="sidebarCollapsed ? '展开侧栏 (])' : '收起侧栏 ([)'"
      @click="toggleSidebar"
    >
      <n-icon :component="sidebarCollapsed ? ChevronForward : ChevronBack" :size="16" />
    </button>

    <div class="map-stage">
      <div ref="mapContainer" class="map-container"></div>

      <div class="layer-switcher-pos">
        <LayerSwitcher
          :base-layers="layerOptions"
          :active-layer="activeLayer"
          @switch="switchLayer"
        />
      </div>

      <div class="map-toolbar-pos">
        <MapToolbar
          :is-fullscreen="isFullscreen"
          @zoom-in="handleZoomIn"
          @zoom-out="handleZoomOut"
          @home="handleHome"
          @fullscreen="toggleFullscreen"
        />
      </div>

      <Transition name="chip-fade">
        <div v-if="loading" class="loading-chip glass-panel">
          <n-spin size="small" stroke="#18a058" />
          <span>正在加载视口…</span>
        </div>
      </Transition>

      <MapTimeline
        :global-min-time="globalMinTime"
        :global-max-time="globalMaxTime"
        :range-start="rangeStart"
        :range-end="rangeEnd"
        :density-buckets="densityBuckets"
        :total-videos="totalVideos"
        :total-images="totalImages"
        :tooltip-target="tooltipTarget"
        @update:range-start="rangeStart = $event"
        @update:range-end="rangeEnd = $event"
        @drag-end="debouncedFetch"
        ref="timelineRef"
      />
    </div>

    <ClusterDrawer
      v-model:show="showClusterPanel"
      :items="clusterMediaList"
      :total-count="clusterMediaTotal"
      :video-count="currentClusterVideoCount"
      :image-count="currentClusterImageCount"
      :loading="clusterLoading"
      :thumb-resolver="resolveItemThumb"
      @load-more="loadMoreClusterMedia"
      @select-media="navigateToDetail"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { animate } from 'motion-v'
import { NIcon, NSpin } from 'naive-ui'
import {
  SunnyOutline,
  MoonOutline,
  MapOutline,
  EarthOutline,
  ChevronForward,
  ChevronBack,
} from '@vicons/ionicons5'

import { getMapAggregation, getClusterMedia } from '../api/map'
import type { MapPointVO, MapClusterVO } from '../api/map'
import { getSystemConfig } from '../api/systemConfig'
import { gcj02ToWgs84, wgs84ToGcj02 } from '../utils/coordTransform'

import MapSidebar, { type SidebarEntry, type EntryFilter } from './map/MapSidebar.vue'
import MapTimeline from './map/MapTimeline.vue'
import LayerSwitcher, { type BaseLayerOption } from './map/LayerSwitcher.vue'
import MapToolbar from './map/MapToolbar.vue'
import ClusterDrawer from './map/ClusterDrawer.vue'

const router = useRouter()
const route = useRoute()
const mapContainer = ref<HTMLDivElement | null>(null)
const wrapperRef = ref<HTMLDivElement | null>(null)
const timelineRef = ref<InstanceType<typeof MapTimeline> | null>(null)

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

const layerOptions = computed<BaseLayerOption[]>(() => [
  { id: 'protomaps-light', name: '浅色', icon: SunnyOutline },
  { id: 'protomaps-dark', name: '深色', icon: MoonOutline },
  { id: 'osm', name: '普通地图', icon: MapOutline },
  { id: 'satellite', name: '卫星图像', icon: EarthOutline },
])

const PROTOMAPS_KEY = import.meta.env.VITE_PROTOMAPS_KEY ?? ''

async function loadVectorStyle(url: string): Promise<maplibregl.StyleSpecification> {
  const res = await fetch(url)
  const text = await res.text()
  const filled = text.replace(/__PROTOMAPS_KEY__/g, PROTOMAPS_KEY)
  return JSON.parse(filled) as maplibregl.StyleSpecification
}

const totalVideos = ref(0)
const totalImages = ref(0)
const loading = ref(false)
const currentZoom = ref(5)

// --- 侧栏 ---
const sidebarCollapsed = ref(false)
const entryFilter = ref<EntryFilter>('all')
const hoveredEntryId = ref<string | null>(null)
const isFullscreen = ref(false)

// 聚合返回的最新数据保留一份给侧栏使用（marker 是命令式渲染的，没有现成的响应式 source）
const currentClusters = shallowRef<MapClusterVO[]>([])
const currentPoints = shallowRef<MapPointVO[]>([])

// --- 簇内媒体 ---
const showClusterPanel = ref(false)
const clusterMediaList = ref<MapPointVO[]>([])
const clusterMediaTotal = ref(0)
const clusterLoading = ref(false)
const currentClusterVideoCount = ref(0)
const currentClusterImageCount = ref(0)
let currentClusterId = ''
let currentClusterPage = 1
const CLUSTER_PAGE_SIZE = 20

// --- 时间轴状态（由 MapTimeline 子组件 v-model 双向绑定）---
const globalMinTime = ref(new Date('2020-01-01').getTime())
const globalMaxTime = ref(Date.now())
const rangeStart = ref(0)
const rangeEnd = ref(1)
const densityBuckets = ref<number[]>([])
const MIN_RANGE = 0.01

// 拖动 tooltip 在全屏模式下要 teleport 到 wrapper（document.fullscreenElement 子树之外的元素会被隐藏）
const tooltipTarget = computed<string | HTMLElement>(() => {
  if (isFullscreen.value && wrapperRef.value) return wrapperRef.value
  return 'body'
})

const selectedStartTime = computed(() =>
  globalMinTime.value + rangeStart.value * (globalMaxTime.value - globalMinTime.value)
)
const selectedEndTime = computed(() =>
  globalMinTime.value + rangeEnd.value * (globalMaxTime.value - globalMinTime.value)
)

/**
 * 当前显示在地图上的标记。聚合接口每次返回都会清掉旧的、补上新的，
 * 同时用 motion-v 的 animate() 在新旧之间做「合并 / 分散」过渡：
 *  - 缩放后的新标记从最近旧标记位置 translate 进入
 *  - 旧标记被新标记淘汰时，先飞向最近新标记位置再缩小淡出
 * 记录每个标记当时使用的 lng/lat 是为了在下一帧用 map.project() 重新算屏幕像素位置。
 * entryId 用来与侧栏列表项做双向 hover 联动。
 */
interface MarkerEntry {
  marker: maplibregl.Marker
  motionWrapper: HTMLElement
  el: HTMLElement
  lng: number
  lat: number
  entryId: string
}
const markerEntries: MarkerEntry[] = []
// 标记从源点 translate 进入 / 飞向目标的最大像素距离，超过则视为「凭空出现 / 直接消失」，避免 pan 时出现长距离飞行
const MOTION_MATCH_PX = 320
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let fetchSeq = 0

// --- 时间工具 ---

function getTimeParams(): { startDate?: string; endDate?: string } {
  if (rangeStart.value <= 0 && rangeEnd.value >= 1) return {}
  const fmt = (ts: number) => new Date(ts).toISOString().slice(0, 10)
  return {
    startDate: fmt(selectedStartTime.value),
    endDate: fmt(selectedEndTime.value),
  }
}

// --- 聚合数据驱动的时间轴更新 ---

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

function updateTimelineFromAggregation(data: {
  minTime?: string;
  maxTime?: string;
  bucketCount?: number;
  bucketWidthSeconds?: number;
  timeHistogram?: { index: number; start: string; count: number }[];
}) {
  if (data.minTime && data.maxTime) {
    const newMin = new Date(data.minTime).getTime()
    const newMax = new Date(data.maxTime).getTime()

    // 后端 getTimeRangeInBounds 只看 bbox，视口变化会导致 globalMinTime/globalMaxTime 浮动。
    // rangeStart/rangeEnd 是相对比例，如果让比例不动、直接替换 global 端点，
    // 用户选择的绝对时间窗口会跟着漂移（筛选条贴在两端时最明显）。
    //
    // 这里采用「贴边感知 + 绝对时间锚点」混合策略：
    //  - rangeStart=0（贴左）→ 保持贴左，表达「从最老开始」；
    //  - rangeEnd=1 （贴右）→ 保持贴右，表达「到最新为止」；
    //  - 两端非贴边 → 保持绝对时间不变，只重新映射比例；
    //  - pendingTimeRange 存在时跳过，避免和 applyPendingTimeRange 打架。
    const oldSpan = globalMaxTime.value - globalMinTime.value
    const newSpan = newMax - newMin
    const shouldRemap = !pendingTimeRange && oldSpan > 0 && newSpan > 0

    const anchorLeft = rangeStart.value <= 0
    const anchorRight = rangeEnd.value >= 1
    const prevStart = shouldRemap ? selectedStartTime.value : 0
    const prevEnd = shouldRemap ? selectedEndTime.value : 0

    globalMinTime.value = newMin
    globalMaxTime.value = newMax

    if (shouldRemap && !(anchorLeft && anchorRight)) {
      let newS = anchorLeft ? 0 : (prevStart - newMin) / newSpan
      let newE = anchorRight ? 1 : (prevEnd - newMin) / newSpan
      newS = clamp(newS, 0, 1)
      newE = clamp(newE, 0, 1)

      // 原窗口被 clamp 压扁时退化到一侧，避免反弹回全范围
      if (newE - newS < MIN_RANGE) {
        const stickRight = anchorRight || (!anchorLeft && prevStart > newMax)
        if (stickRight) {
          newE = 1
          newS = 1 - MIN_RANGE
        } else {
          newS = 0
          newE = MIN_RANGE
        }
      }
      rangeStart.value = newS
      rangeEnd.value = newE
    }
  }
  if (data.timeHistogram) {
    const count = data.bucketCount ?? data.timeHistogram.length
    const bars = new Array<number>(count).fill(0)
    data.timeHistogram.forEach(({ index, count }) => {
      bars[index] = count
    })
    densityBuckets.value = bars
  }
  nextTick(() => timelineRef.value?.redraw())

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
  debouncedFetch()
}

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

function resolveItemThumb(item: MapPointVO): string {
  return resolveThumbnail(item.objectKey, item.thumbnailUrl, item.mediaType)
}

// --- 媒体类型 SVG（marker 内嵌用，因为 marker DOM 是字符串拼接的，不能用 vue 组件） ---

const VIDEO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`
const IMAGE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`

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

  activeLayer.value = layerId

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

  // 结构说明（自外而内）：
  //   .marker-motion-wrapper  ← motion-v 控制（scale/translate 进入退出动画）
  //     .cluster-scale-layer  ← hover 缩放层；同时承担"badge 跟随"的责任
  //       .cluster-marker-inner ← 视觉容器（圆角裁剪图片）
  //         img.cluster-thumb
  //       .cluster-count       ← 数量徽章，与 inner 同层；hover 时随 scale-layer 一起放大
  // 把 count 放在 inner 的 overflow:hidden 之外能让它伸出圆角；放在 scale-layer 内能让它跟着 hover 一起缩放。
  el.innerHTML = `
    <div class="marker-motion-wrapper">
      <div class="cluster-scale-layer">
        <div class="cluster-marker-inner">
          <img src="${thumbUrl}" class="cluster-thumb" alt="" />
        </div>
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
  const typeSvg = point.mediaType === 'video' ? VIDEO_SVG : IMAGE_SVG

  el.innerHTML = `
    <div class="marker-motion-wrapper">
      <div class="point-marker-inner">
        <img src="${thumbUrl}" class="point-thumb" alt="" />
        <span class="point-type-badge ${point.mediaType}">${typeSvg}</span>
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

const IN_PLACE_PX = 4

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

function animateMarkerOutAndRemove(entry: MarkerEntry, dst: { dx: number; dy: number } | null) {
  if (dst && Math.hypot(dst.dx, dst.dy) <= IN_PLACE_PX) {
    entry.marker.remove()
    return
  }
  const target = entry.motionWrapper
  target.style.zIndex = '0'
  const targetState = dst
    ? { x: dst.dx, y: dst.dy, scale: 0.4, opacity: 0 }
    : { scale: 0.5, opacity: 0 }
  const controls = animate(target, targetState, { duration: 0.35, ease: [0.4, 0, 1, 1] })
  controls.then(() => entry.marker.remove()).catch(() => entry.marker.remove())
}

function clusterEntryId(c: MapClusterVO) { return `cluster:${c.clusterId}` }
function pointEntryId(p: MapPointVO) { return `point:${p.uuid}` }

function attachMarkerHoverEvents(el: HTMLElement, entryId: string) {
  el.addEventListener('mouseenter', () => { hoveredEntryId.value = entryId })
  el.addEventListener('mouseleave', () => {
    if (hoveredEntryId.value === entryId) hoveredEntryId.value = null
  })
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

    const entryId = clusterEntryId(cluster)
    el.dataset.entryId = entryId
    el.addEventListener('click', () => openClusterMedia(cluster))
    attachMarkerHoverEvents(el, entryId)
    markerEntries.push({ marker, motionWrapper, el, lng, lat: tLat, entryId })

    const px = projectLngLat(lng, tLat)
    if (px) {
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

    const entryId = pointEntryId(point)
    el.dataset.entryId = entryId
    el.addEventListener('click', () => navigateToDetail(point))
    attachMarkerHoverEvents(el, entryId)
    markerEntries.push({ marker, motionWrapper, el, lng, lat: tLat, entryId })

    const px = projectLngLat(lng, tLat)
    if (px) {
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
  const bounds = bboxToGcj02(wgsBounds)
  const zoom = Math.round(map.getZoom())
  currentZoom.value = zoom

  loading.value = true
  try {
    const data = await getMapAggregation({ ...bounds, zoom, ...getTimeParams() })

    if (seq !== fetchSeq) return

    totalVideos.value = data.totalVideos
    totalImages.value = data.totalImages
    currentClusters.value = data.clusters
    currentPoints.value = data.points
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

    // hover 高亮（如果当前 hoveredEntryId 命中新出现的标记）
    syncMarkerActive()
  } catch (e) {
    if (seq !== fetchSeq) return
    console.error('地图聚合请求失败', e)
  } finally {
    if (seq === fetchSeq) loading.value = false
  }
}

function debouncedFetch() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(fetchAggregation, 400)
}

// --- hover 同步：地图 marker ↔ 侧栏列表 ---

watch(hoveredEntryId, () => syncMarkerActive())

function syncMarkerActive() {
  const id = hoveredEntryId.value
  for (const entry of markerEntries) {
    const isActive = entry.entryId === id
    entry.el.classList.toggle('is-active', isActive)
  }
}

function onHoverEntry(id: string | null) {
  hoveredEntryId.value = id
}

function onSelectEntry(entry: SidebarEntry) {
  if (!map) return
  if (entry.kind === 'cluster') {
    const cluster = currentClusters.value.find(c => clusterEntryId(c) === entry.id)
    if (!cluster) return
    const [lng, lat] = gcj02ToWgs84(cluster.longitude, cluster.latitude)
    const targetZoom = Math.min((map.getZoom() ?? 0) + 2, 16)
    map.flyTo({ center: [lng, lat], zoom: targetZoom, duration: 700 })
    openClusterMedia(cluster)
  } else {
    const point = currentPoints.value.find(p => pointEntryId(p) === entry.id)
    if (!point) return
    const [lng, lat] = gcj02ToWgs84(point.longitude, point.latitude)
    map.flyTo({ center: [lng, lat], zoom: Math.max(map.getZoom() ?? 0, 14), duration: 600 })
    pulseMarker(entry.id)
  }
}

function pulseMarker(entryId: string) {
  const entry = markerEntries.find(e => e.entryId === entryId)
  if (!entry) return
  // 短暂闪烁高亮，0.9s 后自动取消
  entry.el.classList.add('is-pulse')
  window.setTimeout(() => entry.el.classList.remove('is-pulse'), 900)
}

// --- 侧栏 entries 派生 ---

function clusterTitle(c: MapClusterVO) {
  return `${c.count} 项媒体`
}

function clusterSubtitle(c: MapClusterVO) {
  const parts: string[] = []
  if (c.imageCount > 0) parts.push(`${c.imageCount} 图片`)
  if (c.videoCount > 0) parts.push(`${c.videoCount} 视频`)
  return parts.join(' · ')
}

function pointTitleFromKey(p: MapPointVO) {
  // 取最后一段路径作为「文件名」展示
  const key = p.objectKey || ''
  const seg = key.split('/').filter(Boolean).pop() ?? p.uuid
  return seg.length > 36 ? seg.slice(0, 33) + '…' : seg
}

function pointSubtitle(p: MapPointVO) {
  const ns = p.latitude >= 0 ? 'N' : 'S'
  const ew = p.longitude >= 0 ? 'E' : 'W'
  return `${Math.abs(p.latitude).toFixed(3)}°${ns} ${Math.abs(p.longitude).toFixed(3)}°${ew}`
}

const allEntries = computed<SidebarEntry[]>(() => {
  const list: SidebarEntry[] = []
  for (const c of currentClusters.value) {
    list.push({
      id: clusterEntryId(c),
      kind: 'cluster',
      title: clusterTitle(c),
      subtitle: clusterSubtitle(c),
      thumb: resolveThumbnail(c.representativeObjectKey, c.representativeThumbnailUrl, c.representativeMediaType),
      count: c.count,
      videoCount: c.videoCount,
      imageCount: c.imageCount,
      mediaType: c.representativeMediaType,
      lng: c.longitude,
      lat: c.latitude,
      raw: c,
    })
  }
  for (const p of currentPoints.value) {
    list.push({
      id: pointEntryId(p),
      kind: 'point',
      title: pointTitleFromKey(p),
      subtitle: pointSubtitle(p),
      thumb: resolveThumbnail(p.objectKey, p.thumbnailUrl, p.mediaType),
      count: 1,
      videoCount: p.mediaType === 'video' ? 1 : 0,
      imageCount: p.mediaType === 'image' ? 1 : 0,
      mediaType: p.mediaType,
      lng: p.longitude,
      lat: p.latitude,
      raw: p,
    })
  }
  // 簇优先 + 数量降序，单点放后面
  return list.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'cluster' ? -1 : 1
    return b.count - a.count
  })
})

const filteredEntries = computed<SidebarEntry[]>(() => {
  const f = entryFilter.value
  if (f === 'all') return allEntries.value
  if (f === 'video') return allEntries.value.filter(e => e.videoCount > 0)
  return allEntries.value.filter(e => e.imageCount > 0)
})

// --- 侧栏折叠 ---

function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value
  // 等 CSS transition 完成（300ms）再 resize，否则 maplibre 会按旧宽度渲染
  window.setTimeout(() => {
    map?.resize()
  }, 320)
}

// --- 地图工具栏 ---

function handleZoomIn() { map?.zoomIn() }
function handleZoomOut() { map?.zoomOut() }
function handleHome() {
  if (!map) return
  // 默认中心广州（广东省会，WGS-84），与初始视图一致
  map.flyTo({ center: [113.2644, 23.1291], zoom: 5, duration: 800 })
}

async function toggleFullscreen() {
  const el = wrapperRef.value
  if (!el) return
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
    } else {
      await el.requestFullscreen()
    }
  } catch (err) {
    console.warn('全屏切换失败', err)
  }
}

function onFullscreenChange() {
  isFullscreen.value = document.fullscreenElement === wrapperRef.value
  // 全屏切换会改变可视区，需重置地图尺寸
  window.setTimeout(() => map?.resize(), 80)
}

// --- 簇内媒体 ---

async function openClusterMedia(cluster: MapClusterVO) {
  currentClusterId = cluster.clusterId
  currentClusterPage = 1
  clusterMediaList.value = []
  clusterMediaTotal.value = cluster.count
  currentClusterVideoCount.value = cluster.videoCount
  currentClusterImageCount.value = cluster.imageCount
  showClusterPanel.value = true

  clusterLoading.value = true
  try {
    const res = await getClusterMedia(cluster.clusterId, 1, CLUSTER_PAGE_SIZE)
    if (currentClusterId !== cluster.clusterId) return
    clusterMediaList.value = res.data
    clusterMediaTotal.value = res.total
  } catch (e) {
    console.error('获取簇内媒体失败', e)
  } finally {
    clusterLoading.value = false
  }
}

async function loadMoreClusterMedia() {
  if (clusterLoading.value) return
  if (clusterMediaList.value.length >= clusterMediaTotal.value) return
  const nextPage = currentClusterPage + 1
  clusterLoading.value = true
  try {
    const res = await getClusterMedia(currentClusterId, nextPage, CLUSTER_PAGE_SIZE)
    currentClusterPage = nextPage
    clusterMediaList.value.push(...res.data)
  } catch (e) {
    console.error('加载更多失败', e)
  } finally {
    clusterLoading.value = false
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

// --- 键盘快捷键 ---

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (target.isContentEditable) return true
  return false
}

function onKeyDown(e: KeyboardEvent) {
  if (isTypingTarget(e.target)) return
  if (e.metaKey || e.ctrlKey || e.altKey) return

  switch (e.key) {
    case '[':
      sidebarCollapsed.value = true
      window.setTimeout(() => map?.resize(), 320)
      e.preventDefault()
      break
    case ']':
      sidebarCollapsed.value = false
      window.setTimeout(() => map?.resize(), 320)
      e.preventDefault()
      break
    case '+':
    case '=':
      handleZoomIn()
      e.preventDefault()
      break
    case '-':
    case '_':
      handleZoomOut()
      e.preventDefault()
      break
    case 'f':
    case 'F':
      toggleFullscreen()
      e.preventDefault()
      break
    case 'h':
    case 'H':
      handleHome()
      e.preventDefault()
      break
    case 'Escape':
      if (showClusterPanel.value) {
        showClusterPanel.value = false
      }
      break
  }
}

// --- 生命周期 ---

let resizeObserver: ResizeObserver | null = null

onMounted(async () => {
  // 移动端默认收起侧栏，避免 320px 侧栏挤压窄屏地图
  if (window.innerWidth < 720) {
    sidebarCollapsed.value = true
  }

  const domainConfig = await getSystemConfig('storage', 'custom_domain').catch(() => null)
  if (domainConfig?.value) {
    customDomain.value = domainConfig.value
  }

  const initialStyle = await loadVectorStyle('/map-styles/light.json')

  const initialView = resolveInitialView()

  map = new maplibregl.Map({
    container: mapContainer.value!,
    style: initialStyle,
    center: initialView.center,
    zoom: initialView.zoom,
  })

  map.on('load', () => {
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
  map.on('zoom', () => {
    if (map) currentZoom.value = Math.round(map.getZoom())
  })

  document.addEventListener('keydown', onKeyDown)
  document.addEventListener('fullscreenchange', onFullscreenChange)

  // 监听 wrapper 尺寸变化，自动 resize 地图（侧栏 transition / 全屏 / 窗口缩放都会触发）
  if (wrapperRef.value) {
    resizeObserver = new ResizeObserver(() => map?.resize())
    resizeObserver.observe(wrapperRef.value)
  }
})

function resolveInitialView(): { center: [number, number]; zoom: number } {
  // 默认中心广州（WGS-84，[lng, lat]）。无 ?bbox / ?lat&lng 等首屏参数时落在广东，
  // 与 handleHome / 管理后台 LocationPicker 默认中心保持一致。
  const defaultView = { center: [113.2644, 23.1291] as [number, number], zoom: 5 }
  let center = defaultView.center
  let zoom = defaultView.zoom

  const bbox = parseBboxQuery()
  if (bbox) {
    const [swLng, swLat] = gcj02ToWgs84(bbox[0][0], bbox[0][1])
    const [neLng, neLat] = gcj02ToWgs84(bbox[1][0], bbox[1][1])
    pendingBbox = [[swLng, swLat], [neLng, neLat]]
    center = [(swLng + neLng) / 2, (swLat + neLat) / 2]
    zoom = 8
  } else {
    const lat = parseFloat(String(route.query.lat ?? ''))
    const lng = parseFloat(String(route.query.lng ?? ''))
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      const [wgsLng, wgsLat] = gcj02ToWgs84(lng, lat)
      center = [wgsLng, wgsLat]
      zoom = 11
    }
  }

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
  document.removeEventListener('keydown', onKeyDown)
  document.removeEventListener('fullscreenchange', onFullscreenChange)
})
</script>

<style scoped>
@import './map/mapTokens.css';

.map-wrapper {
  height: 100%;
  width: 100%;
  display: flex;
  position: relative;
  background: #0e0e0e;
  overflow: hidden;
}

.map-stage {
  position: relative;
  flex: 1;
  min-width: 0;
  height: 100%;
}

.map-container {
  position: absolute;
  inset: 0;
}

/* 侧栏与折叠把手 */
.sidebar-handle {
  position: absolute;
  top: 50%;
  /* 默认贴在侧栏右沿 */
  left: var(--map-sidebar-width);
  transform: translate(-50%, -50%);
  width: 24px;
  height: 56px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  border: 1px solid var(--map-glass-border);
  background: var(--map-glass-bg-strong);
  color: var(--map-text-secondary);
  cursor: pointer;
  z-index: calc(var(--map-z-floating) + 1);
  transition: left 0.28s cubic-bezier(0.22, 1, 0.36, 1), background 0.18s ease, color 0.18s ease;
  padding: 0;
}

.sidebar-handle:hover {
  background: var(--map-glass-bg-strong);
  color: var(--map-text-primary);
}

.map-wrapper.sidebar-collapsed .sidebar-handle {
  left: 0;
  transform: translate(0, -50%);
  border-radius: 0 12px 12px 0;
  border-left: none;
}

/* 浮层定位（避开侧栏） */
.layer-switcher-pos {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: var(--map-z-floating);
}

.map-toolbar-pos {
  position: absolute;
  top: 64px;
  right: 12px;
  z-index: var(--map-z-floating);
}

.loading-chip {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border-radius: var(--map-radius-pill);
  font-size: 12px;
  color: var(--map-text-secondary);
  z-index: var(--map-z-floating);
  pointer-events: none;
}

.chip-fade-enter-active,
.chip-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.chip-fade-enter-from,
.chip-fade-leave-to {
  opacity: 0;
  transform: translate(-50%, -8px);
}

/* 侧栏过渡：宽度收缩动画由 MapSidebar.collapsed 自身控制；
   .sidebar-collapsed 时 wrapper 进入"无侧栏"流式布局 */
.map-sidebar {
  transition: width 0.28s cubic-bezier(0.22, 1, 0.36, 1),
              border-right-width 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}

@media (max-width: 720px) {
  .map-toolbar-pos {
    top: auto;
    bottom: 130px;
  }
}
</style>

<!-- maplibre marker 是 document.createElement 出来直接挂在地图 canvas 上的，
     不在 Vue scoped 选择器作用域内，相关样式必须放在非 scoped 块。 -->
<style>
@import './map/mapTokens.css';

/* ---- 标记锚点（MapLibre 直接控制此元素的 transform，不要在这里加 transition/transform） ---- */
.marker-anchor {
  cursor: pointer;
}

/* ---- motion 包裹层：motion-v 的 animate() 独占这一层的 transform/opacity ----
   不要在这层写 hover、transition，避免和 WAAPI 抢同一属性；hover 的视觉缩放放在内层。
   position: relative 让 .cluster-count 等"溢出徽章"以包裹层为定位根，能伸出 .cluster-marker-inner 的 overflow:hidden 边界。 */
.marker-motion-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  transform-origin: 50% 50%;
  will-change: transform, opacity;
}

/* ---- 聚合簇标记 ---- */
/* hover 缩放层：把 inner + count 都包进来一起 scale，避免徽章脱节。
   transform-origin 居中，让外圈视觉效果以 marker 中心为锚。 */
.cluster-scale-layer {
  position: absolute;
  inset: 0;
  transform-origin: 50% 50%;
  transition: transform 0.2s ease;
}

.marker-anchor:hover .cluster-scale-layer,
.marker-anchor.is-active .cluster-scale-layer {
  transform: scale(1.12);
  z-index: 10;
}

.cluster-marker-inner {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 10px;
  overflow: hidden;
  border: 3px solid rgba(255, 255, 255, 0.92);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.45);
  box-sizing: border-box;
  transition: box-shadow 0.2s ease, border-color 0.2s ease;
}

.marker-anchor:hover .cluster-marker-inner,
.marker-anchor.is-active .cluster-marker-inner {
  box-shadow: 0 6px 22px rgba(0, 0, 0, 0.55), 0 0 0 4px rgba(24, 160, 88, 0.35);
  border-color: var(--map-accent);
}

.cluster-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.cluster-count {
  position: absolute;
  top: -6px;
  right: -6px;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  background: var(--map-accent-strong);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 22px;
  text-align: center;
  border-radius: 11px;
  border: 2px solid #fff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
  font-family: system-ui, sans-serif;
}

/* ---- 单点标记 ---- */
.point-marker-inner {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 10px;
  overflow: hidden;
  border: 2px solid rgba(255, 255, 255, 0.92);
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.4);
  box-sizing: border-box;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.marker-anchor:hover .point-marker-inner,
.marker-anchor.is-active .point-marker-inner {
  transform: scale(1.1);
  box-shadow: 0 5px 16px rgba(0, 0, 0, 0.5), 0 0 0 4px rgba(24, 160, 88, 0.32);
  border-color: var(--map-accent);
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
  top: 4px;
  left: 4px;
  width: 18px;
  height: 18px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.18);
  color: #fff;
}

.point-type-badge.video {
  background: color-mix(in srgb, var(--map-video) 80%, rgba(0, 0, 0, 0.5));
}

.point-type-badge.image {
  background: color-mix(in srgb, var(--map-image) 80%, rgba(0, 0, 0, 0.5));
}

.point-type-badge svg {
  display: block;
}

/* ---- pulse: 侧栏点击单点时短暂高亮 ---- */
@keyframes marker-pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(24, 160, 88, 0.6);
  }
  70% {
    box-shadow: 0 0 0 18px rgba(24, 160, 88, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(24, 160, 88, 0);
  }
}

.marker-anchor.is-pulse .cluster-marker-inner,
.marker-anchor.is-pulse .point-marker-inner {
  animation: marker-pulse 0.9s ease-out;
}
</style>

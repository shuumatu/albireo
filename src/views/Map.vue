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

    <!-- 统计信息 -->
    <div v-if="totalVideos > 0 || totalImages > 0" class="stats-badge">
      <span v-if="totalVideos > 0">🎬 {{ totalVideos }}</span>
      <span v-if="totalImages > 0">🖼 {{ totalImages }}</span>
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
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { getMapAggregation, getClusterMedia } from '../api/map'
import type { MapPointVO, MapClusterVO } from '../api/map'
import { getSystemConfig } from '../api/systemConfig'

const router = useRouter()
const mapContainer = ref<HTMLDivElement | null>(null)
let map: maplibregl.Map | null = null
const activeLayer = ref('osm')
const customDomain = ref('albireo.shuumatu.com')

const baseLayers = [
  { id: 'osm', name: '普通地图' },
  { id: 'satellite', name: '卫星图像' }
]

const totalVideos = ref(0)
const totalImages = ref(0)

const showClusterPanel = ref(false)
const clusterMediaList = ref<MapPointVO[]>([])
const clusterMediaTotal = ref(0)
let currentClusterId = ''
let currentClusterPage = 1

const markers: maplibregl.Marker[] = []
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let fetchSeq = 0

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

function switchLayer(layerId: string) {
  if (!map) return
  baseLayers.forEach(layer => {
    map!.setLayoutProperty(
      layer.id + '-layer',
      'visibility',
      layer.id === layerId ? 'visible' : 'none'
    )
  })
}

// --- 标记管理 ---

function clearMarkers() {
  markers.forEach(m => m.remove())
  markers.length = 0
}

function createClusterMarkerElement(cluster: MapClusterVO): HTMLDivElement {
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
    <div class="cluster-marker-inner">
      <img src="${thumbUrl}" class="cluster-thumb" alt="" />
      <span class="cluster-count">${cluster.count}</span>
    </div>
  `
  return el
}

function createPointMarkerElement(point: MapPointVO): HTMLDivElement {
  const el = document.createElement('div')
  el.className = 'marker-anchor'
  el.style.width = '60px'
  el.style.height = '60px'

  const thumbUrl = resolveThumbnail(point.objectKey, point.thumbnailUrl, point.mediaType)

  el.innerHTML = `
    <div class="point-marker-inner">
      <img src="${thumbUrl}" class="point-thumb" alt="" />
      <span class="point-type-badge">${point.mediaType === 'video' ? '🎬' : '🖼'}</span>
    </div>
  `
  return el
}

function renderClusters(clusters: MapClusterVO[]) {
  const centerLng = map!.getCenter().lng
  clusters.forEach(cluster => {
    const el = createClusterMarkerElement(cluster)
    const lng = nearestLng(cluster.longitude, centerLng)
    const marker = new maplibregl.Marker({ element: el })
      .setLngLat([lng, cluster.latitude])
      .addTo(map!)

    el.addEventListener('click', () => openClusterMedia(cluster.clusterId))
    markers.push(marker)
  })
}

function renderPoints(points: MapPointVO[]) {
  const centerLng = map!.getCenter().lng
  points.forEach(point => {
    const el = createPointMarkerElement(point)
    const lng = nearestLng(point.longitude, centerLng)
    const marker = new maplibregl.Marker({ element: el })
      .setLngLat([lng, point.latitude])
      .addTo(map!)

    el.addEventListener('click', () => navigateToDetail(point))
    markers.push(marker)
  })
}

// --- 数据加载 ---

async function fetchAggregation() {
  if (!map) return
  const seq = ++fetchSeq
  const bounds = normalizeBounds(map.getBounds())
  const zoom = Math.round(map.getZoom())

  try {
    const data = await getMapAggregation({ ...bounds, zoom })

    if (seq !== fetchSeq) return

    clearMarkers()
    totalVideos.value = data.totalVideos
    totalImages.value = data.totalImages

    if (data.clusters.length > 0) {
      renderClusters(data.clusters)
    }
    if (data.points.length > 0) {
      renderPoints(data.points)
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
  if (point.mediaType === 'video') {
    router.push({ name: 'VideoPlayer', params: { uuid: point.uuid } })
  } else {
    router.push({ name: 'ImageDetail', params: { uuid: point.uuid } })
  }
}

// --- 生命周期 ---

onMounted(async () => {
  const domainConfig = await getSystemConfig('storage', 'custom_domain').catch(() => null)
  if (domainConfig?.value) {
    customDomain.value = domainConfig.value
  }

  map = new maplibregl.Map({
    container: mapContainer.value!,
    style: {
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
          layout: { visibility: 'visible' }
        },
        {
          id: 'satellite-layer',
          type: 'raster',
          source: 'satellite',
          layout: { visibility: 'none' }
        }
      ]
    },
    center: [139.7, 35.6],
    zoom: 5
  })

  map.on('load', () => {
    fetchAggregation()
  })

  map.on('moveend', debouncedFetch)
})

onUnmounted(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
  clearMarkers()
  if (map) {
    map.remove()
    map = null
  }
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
  padding: 10px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 14px;
}

.stats-badge {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 13px;
  z-index: 1;
  display: flex;
  gap: 12px;
  backdrop-filter: blur(4px);
}

/* ---- 标记锚点（MapLibre 直接控制此元素的 transform，不要在这里加 transition/transform） ---- */
.marker-anchor {
  cursor: pointer;
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

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

    <!-- 播放器模态框 -->
    <n-modal v-model:show="showPlayer" preset="card" style="width: 700px;">
      <template #header>{{ selectedVideo?.title }}</template>
      <video controls autoplay style="width: 100%;">
        <source :src="selectedVideo?.videoUrl" type="video/mp4" />
        浏览器不支持视频播放
      </video>
    </n-modal>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

const mapContainer = ref(null)
let map = null
const activeLayer = ref('osm')

const baseLayers = [
  { id: 'osm', name: '普通地图' },
  { id: 'satellite', name: '卫星图像' }
]

const videos = ref([
  {
    id: '1',
    title: '富士山日出',
    location: { lat: 35.3606, lng: 138.7274 },
    thumbnail: '/thumbnails/fuji.jpg',
    videoUrl: 'https://your-cdn.com/videos/fuji.mp4'
  },
  {
    id: '2',
    title: '大阪夜景',
    location: { lat: 34.6937, lng: 135.5023 },
    thumbnail: '/thumbnails/osaka.jpg',
    videoUrl: 'https://your-cdn.com/videos/osaka.mp4'
  }
])

const selectedVideo = ref(null)
const showPlayer = ref(false)
const markers = []

function switchLayer(layerId) {
  if (!map) return
  baseLayers.forEach(layer => {
    map.setLayoutProperty(
      layer.id + '-layer',
      'visibility',
      layer.id === layerId ? 'visible' : 'none'
    )
  })
}

function openVideo(video) {
  selectedVideo.value = video
  showPlayer.value = true
}

function addMarkers() {
  videos.value.forEach(video => {
    const el = document.createElement('div')
    el.className = 'custom-triangle-icon'

    const marker = new maplibregl.Marker({ element: el })
      .setLngLat([video.location.lng, video.location.lat])
      .addTo(map)

    el.addEventListener('click', () => {
      selectedVideo.value = video
    })

    const popupContent = document.createElement('div')
    popupContent.className = 'marker-popup-content'
    popupContent.innerHTML = `
      <img src="${video.thumbnail}" class="popup-thumbnail" />
      <div class="popup-title">${video.title}</div>
    `
    const btn = document.createElement('button')
    btn.className = 'popup-play-btn'
    btn.textContent = '播放'
    btn.addEventListener('click', () => openVideo(video))
    popupContent.appendChild(btn)

    const popup = new maplibregl.Popup({ offset: 10 })
      .setDOMContent(popupContent)

    marker.setPopup(popup)
    markers.push(marker)
  })
}

onMounted(() => {
  map = new maplibregl.Map({
    container: mapContainer.value,
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
    addMarkers()
  })
})

onUnmounted(() => {
  markers.forEach(m => m.remove())
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
  border-radius: 4px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 14px;
}

.custom-triangle-icon {
  width: 0;
  height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-top: 12px solid rgba(255, 255, 255, 0.5);
  cursor: pointer;
}

.marker-popup-content {
  width: 12rem;
}

.popup-thumbnail {
  width: 100%;
  border-radius: 4px;
}

.popup-title {
  font-size: 0.875rem;
  margin-top: 0.5rem;
  font-weight: 600;
}

.popup-play-btn {
  margin-top: 0.5rem;
  padding: 2px 10px;
  font-size: 13px;
  cursor: pointer;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: #fff;
}

.popup-play-btn:hover {
  background: #f0f0f0;
}
</style>

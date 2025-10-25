<template>
  <div style="height: 100vh; width: 100vw;">
    <l-map :zoom="5" :center="[35.6, 139.7]" style="height: 100%;">
      <!-- 图层切换器 -->
      <l-control-layers />

      <!-- 普通地图 -->
      <l-tile-layer
        layer-type="base"
        name="普通地图"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <!-- 卫星图层（Esri） -->
      <l-tile-layer
        layer-type="base"
        name="卫星图像"
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        :attribution="'Tiles © Esri & the GIS community'"
      />

      <!-- 视频标记 -->
      <l-marker
        v-for="video in videos"
        :key="video.id"
        :lat-lng="[video.location.lat, video.location.lng]"
        :icon="triangleIcon"
        @click="selectVideo(video)"
      >
        <l-popup>
          <div class="w-48">
            <img :src="video.thumbnail" class="w-full rounded" />
            <div class="text-sm mt-2 font-semibold">{{ video.title }}</div>
            <n-button size="small" class="mt-2" @click="openVideo(video)">
              播放
            </n-button>
          </div>
        </l-popup>
      </l-marker>
    </l-map>

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
import {
  LMap,
  LTileLayer,
  LMarker,
  LPopup,
  LControlLayers
} from '@vue-leaflet/vue-leaflet'
import 'leaflet/dist/leaflet.css'

// 处理图标路径错误（Leaflet 的老问题）
import L from 'leaflet'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow
})
const triangleIcon = L.divIcon({
  className: 'custom-triangle-icon', // CSS 样式类名
  iconSize: [12, 12], // 图标尺寸（可以调整）
  iconAnchor: [6, 6] // 图标锚点（保持居中）
})

import { ref } from 'vue'

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

function selectVideo(video) {
  selectedVideo.value = video
}

function openVideo(video) {
  selectedVideo.value = video
  showPlayer.value = true
}




</script>
<style>
.custom-triangle-icon {
  width: 0;
  height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-top: 12px solid rgba(255, 255, 255, 0.5); /* 半透明黑色三角 */
}

</style>
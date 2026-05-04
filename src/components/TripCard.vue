<template>
  <div class="trip-card" @click="handleClick">
    <div class="trip-cover">
      <img
        v-if="trip.coverUrl && !errored"
        :src="trip.coverUrl"
        :alt="title"
        loading="lazy"
        @error="errored = true"
      />
      <div v-else class="cover-placeholder">📍</div>

      <div class="cover-overlay">
        <div class="trip-title-block">
          <div class="trip-month">{{ trip.year }} 年 {{ trip.month }} 月</div>
          <div class="trip-date-range">{{ dateRange }}</div>
        </div>
        <div class="trip-meta">
          <span class="meta-item">📷 {{ trip.itemCount }}</span>
          <span class="meta-item place-meta" :title="trip.placeName ? coords : undefined">
            📍 {{ trip.placeName || coords }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { TripVO } from '../api/recommend'

interface Props {
  trip: TripVO
}

const props = defineProps<Props>()
const router = useRouter()
const errored = ref(false)

const title = computed(() => `${props.trip.year}年${props.trip.month}月的旅途`)

const dateRange = computed(() => {
  const start = formatDate(props.trip.startDate)
  const end = formatDate(props.trip.endDate)
  if (!start) return ''
  if (!end || start === end) return start
  return `${start} — ${end}`
})

const coords = computed(() => {
  const lat = props.trip.centerLat
  const lng = props.trip.centerLng
  if (typeof lat !== 'number' || typeof lng !== 'number') return ''
  const ns = lat >= 0 ? 'N' : 'S'
  const ew = lng >= 0 ? 'E' : 'W'
  return `${Math.abs(lat).toFixed(1)}°${ns} ${Math.abs(lng).toFixed(1)}°${ew}`
})

function formatDate(raw: string | null): string {
  if (!raw) return ''
  const d = new Date(raw)
  if (isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function handleClick() {
  // 优先传 bbox：Map.vue 用 fitBounds 让视口紧贴这些媒体，避免视口外溢导致计数对不上
  const route = router.resolve({
    name: 'Map',
    query: {
      bboxMinLng: props.trip.bboxMinLng,
      bboxMinLat: props.trip.bboxMinLat,
      bboxMaxLng: props.trip.bboxMaxLng,
      bboxMaxLat: props.trip.bboxMaxLat,
      start: props.trip.startDate,
      end: props.trip.endDate
    }
  })
  window.open(route.href, '_blank')
}
</script>

<style scoped>
.trip-card {
  width: 320px;
  flex-shrink: 0;
  cursor: pointer;
  border-radius: 12px;
  overflow: hidden;
  background-color: #1a1a1a;
  transition: transform 0.25s ease, box-shadow 0.25s ease;
  position: relative;
}

.trip-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 14px 32px rgba(0, 0, 0, 0.55);
}

.trip-cover {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 10;
  overflow: hidden;
  background-color: #0a0a0a;
}

.trip-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.5s ease;
}

.trip-card:hover .trip-cover img {
  transform: scale(1.06);
}

.cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48px;
  color: rgba(255, 255, 255, 0.25);
  background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%);
}

.cover-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    rgba(0, 0, 0, 0) 0%,
    rgba(0, 0, 0, 0) 35%,
    rgba(0, 0, 0, 0.7) 80%,
    rgba(0, 0, 0, 0.85) 100%
  );
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  color: white;
  pointer-events: none;
}

.trip-title-block {
  margin-bottom: 8px;
}

.trip-month {
  font-size: 20px;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
}

.trip-date-range {
  margin-top: 4px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.75);
  letter-spacing: 0.5px;
}

.trip-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.85);
}

.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 3px 9px;
  border-radius: 11px;
  background-color: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(6px);
}

/* 地名可能较长，限制宽度防止把卡片撑变形 */
.place-meta {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 768px) {
  .trip-card {
    width: 260px;
  }
  .trip-month {
    font-size: 17px;
  }
}
</style>

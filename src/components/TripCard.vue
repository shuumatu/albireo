<template>
  <router-link
    class="trip-card"
    :to="tripRoute"
    :aria-label="`查看${title}的地图`"
  >
    <div class="trip-cover">
      <MediaImage :renditions="trip.renditions"
        v-if="trip.coverUrl && !errored"
        :src="trip.coverUrl"
        :alt="title"
        loading="lazy"
        @error="errored = true"
      />
      <div v-else class="cover-placeholder">⌖</div>

      <div class="cover-overlay">
        <div class="trip-title-block">
          <div class="trip-month">{{ trip.year }} 年 {{ trip.month }} 月</div>
          <div class="trip-date-range">{{ dateRange }}</div>
        </div>
        <div class="trip-meta">
          <span class="meta-item">▧ {{ trip.itemCount }}</span>
          <span
            class="meta-item place-meta"
            :title="trip.placeName ? coords : undefined"
          >
            📍 {{ trip.placeName || coords }}
          </span>
        </div>
      </div>
    </div>
  </router-link>
</template>

<script setup lang="ts">
import MediaImage from './MediaImage.vue'

import { computed, ref } from 'vue'
import type { TripVO } from '../api/recommend'

interface Props {
  trip: TripVO
}

const props = defineProps<Props>()
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

const tripRoute = computed(() => {
  // 优先传 bbox：Map.vue 用 fitBounds 让视口紧贴这些媒体，避免视口外溢导致计数对不上
  return {
    name: 'Map',
    query: {
      bboxMinLng: props.trip.bboxMinLng,
      bboxMinLat: props.trip.bboxMinLat,
      bboxMaxLng: props.trip.bboxMaxLng,
      bboxMaxLat: props.trip.bboxMaxLat,
      start: props.trip.startDate,
      end: props.trip.endDate
    }
  }
})
</script>

<style scoped>
.trip-card {
  display: block;
  width: 340px;
  flex-shrink: 0;
  color: var(--text);
  position: relative;
  overflow: hidden;
  border: 1px solid var(--line);
}
.trip-cover {
  position: relative;
  aspect-ratio: 16/10;
  background: var(--surface);
  overflow: hidden;
}
.trip-cover :deep(img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.22s;
}
.trip-card:is(:hover, :focus-visible) :deep(img) {
  transform: scale(1.025);
}
.cover-placeholder {
  height: 100%;
  display: grid;
  place-items: center;
  color: var(--muted);
}
.cover-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(transparent 20%, #081014ed);
  padding: 24px;
  display: flex;
  flex-direction: column;
  justify-content: end;
  color: #f1eee6;
}
.trip-month {
  font-size: 22px;
  letter-spacing: 1px;
  color: var(--on-photo-gold);
}
.trip-date-range {
  font: 11px var(--mono);
  margin-top: 8px;
  color: #c3cddd;
}
.trip-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 20px;
  padding-top: 12px;
  border-top: 1px solid #80b5f460;
  font-size: 12px;
}
.place-meta {
  max-width: 100%;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.trip-card:after {
  content: '↗';
  position: absolute;
  top: 12px;
  right: 14px;
  color: var(--on-photo-blue);
  font-size: 20px;
  text-shadow: 0 1px 6px #000;
}
@media (max-width: 700px) {
  .trip-card {
    width: 280px;
  }
  .trip-month {
    font-size: 20px;
  }
}
</style>

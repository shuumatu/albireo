<template>
  <router-link
    class="trip-card"
    :to="tripRoute"
    :aria-label="`查看${title}的地图`"
  >
    <div class="trip-cover">
      <MediaImage
        v-if="hasCover && !errored"
        :key="`${coverSourceKey}-${useCoverFallback}`"
        :renditions="useCoverFallback ? undefined : coverRenditions"
        :src="trip.coverUrl"
        :alt="title"
        loading="lazy"
        @error="onCoverError"
      />
      <div v-else class="cover-placeholder">⌖</div>

      <div class="cover-overlay">
        <div class="trip-title-block">
          <div class="trip-month">{{ trip.year }} 年 {{ trip.month }} 月</div>
          <div class="trip-date-range">{{ dateRange }}</div>
        </div>
        <div class="trip-meta">
          <span class="meta-item">▧ {{ trip.itemCount }} 件作品</span>
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

import { computed, ref, watch } from 'vue'
import type { TripVO } from '../api/recommend'
import { tripCalendarDate, tripMapRoute } from '../utils/tripMap'
import { imageCandidates } from '../utils/mediaQuality'

interface Props {
  trip: TripVO
}

const props = defineProps<Props>()
const errored = ref(false)
const useCoverFallback = ref(false)
const coverRenditions = computed(() => [
  ...imageCandidates(props.trip.renditions, 'image/avif'),
  ...imageCandidates(props.trip.renditions, 'image/webp')
])
const hasCover = computed(() => Boolean(props.trip.coverUrl || coverRenditions.value.length))
const coverSourceKey = computed(() => JSON.stringify([
  props.trip.tripId, props.trip.coverUrl, coverRenditions.value
]))
watch([() => props.trip, coverSourceKey], () => {
  errored.value = false
  useCoverFallback.value = false
}, { flush: 'sync' })

function onCoverError() {
  if (!useCoverFallback.value && coverRenditions.value.length && props.trip.coverUrl) {
    useCoverFallback.value = true
    return
  }
  errored.value = true
}

const title = computed(() => `${props.trip.year}年${props.trip.month}月的旅途`)

const dateRange = computed(() => {
  const start = tripCalendarDate(props.trip.startDate)
  const end = tripCalendarDate(props.trip.endDate)
  if (!start) return ''
  if (!end || start === end) return start
  return `${start} — ${end}`
})

const coords = computed(() => {
  const lat = props.trip.centerLat
  const lng = props.trip.centerLng
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '地点待补充'
  const ns = lat >= 0 ? 'N' : 'S'
  const ew = lng >= 0 ? 'E' : 'W'
  return `${Math.abs(lat).toFixed(1)}°${ns} ${Math.abs(lng).toFixed(1)}°${ew}`
})

const tripRoute = computed(() => tripMapRoute(props.trip))
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
.trip-card:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 4px;
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
    width: min(280px, calc(100vw - 48px));
  }
  .trip-month {
    font-size: 20px;
  }
}
</style>

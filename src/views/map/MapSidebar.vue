<template>
  <aside class="map-sidebar" :class="{ collapsed }" :aria-hidden="collapsed">
    <header class="sidebar-head">
      <div class="head-title">
        <n-icon :component="LayersOutline" :size="18" />
        <span>视口内容</span>
      </div>
      <div class="filter-chips" role="tablist" aria-label="按媒体类型筛选">
        <button
          type="button"
          role="tab"
          :class="['chip', { active: filter === 'all' }]"
          :aria-selected="filter === 'all'"
          @click="$emit('update:filter', 'all')"
        >
          全部
          <span class="chip-count">{{ totalVideos + totalImages }}</span>
        </button>
        <button
          type="button"
          role="tab"
          :class="['chip', { active: filter === 'video' }]"
          :aria-selected="filter === 'video'"
          @click="$emit('update:filter', 'video')"
        >
          <n-icon :component="VideocamOutline" :size="14" />
          <span class="chip-count">{{ totalVideos }}</span>
        </button>
        <button
          type="button"
          role="tab"
          :class="['chip', { active: filter === 'image' }]"
          :aria-selected="filter === 'image'"
          @click="$emit('update:filter', 'image')"
        >
          <n-icon :component="ImageOutline" :size="14" />
          <span class="chip-count">{{ totalImages }}</span>
        </button>
      </div>
    </header>

    <div class="sidebar-body">
      <div v-if="entries.length === 0" class="empty-state">
        <n-icon :component="NavigateOutline" :size="32" />
        <p>当前视口内没有内容</p>
        <p class="empty-hint">试试缩小地图或拖动到其它区域</p>
      </div>
      <n-scrollbar v-else class="entry-scroll">
        <ul class="entry-list">
          <li
            v-for="entry in entries"
            :key="entry.id"
            :class="['entry-item', { hovered: hoveredId === entry.id }]"
            @mouseenter="$emit('hoverEntry', entry.id)"
            @mouseleave="$emit('hoverEntry', null)"
            @click="$emit('selectEntry', entry)"
          >
            <div class="entry-thumb-wrap">
              <img
                :src="entry.thumb"
                class="entry-thumb"
                :alt="entry.title"
                loading="lazy"
                @error="onThumbError"
              />
              <span v-if="entry.kind === 'cluster'" class="entry-badge">{{ entry.count }}</span>
              <span v-else class="entry-type-pill" :class="entry.mediaType">
                <n-icon
                  :component="entry.mediaType === 'video' ? VideocamOutline : ImageOutline"
                  :size="11"
                />
              </span>
            </div>
            <div class="entry-meta">
              <div class="entry-title">{{ entry.title }}</div>
              <div class="entry-sub">{{ entry.subtitle }}</div>
            </div>
            <n-icon class="entry-arrow" :component="ChevronForward" :size="14" />
          </li>
        </ul>
      </n-scrollbar>
    </div>

    <footer class="sidebar-foot">
      <span class="foot-stat">
        <strong>{{ entries.length }}</strong> 项可见
      </span>
      <span class="foot-stat foot-zoom">zoom {{ zoom }}</span>
    </footer>
  </aside>
</template>

<script setup lang="ts">
import { NIcon, NScrollbar } from 'naive-ui'
import {
  VideocamOutline,
  ImageOutline,
  LayersOutline,
  ChevronForward,
  NavigateOutline,
} from '@vicons/ionicons5'

export type EntryFilter = 'all' | 'video' | 'image'

export interface SidebarEntry {
  id: string
  kind: 'cluster' | 'point'
  title: string
  subtitle: string
  thumb: string
  count: number
  videoCount: number
  imageCount: number
  mediaType: 'video' | 'image'
  lng: number
  lat: number
  raw: unknown
}

defineProps<{
  entries: SidebarEntry[]
  hoveredId: string | null
  collapsed: boolean
  zoom: number
  filter: EntryFilter
  totalVideos: number
  totalImages: number
}>()

defineEmits<{
  (e: 'hoverEntry', id: string | null): void
  (e: 'selectEntry', entry: SidebarEntry): void
  (e: 'update:filter', filter: EntryFilter): void
}>()

function onThumbError(event: Event) {
  const img = event.target as HTMLImageElement
  img.style.opacity = '0.25'
}
</script>

<style scoped>
@import './mapTokens.css';

.map-sidebar {
  position: relative;
  width: var(--map-sidebar-width);
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--map-glass-bg-strong);
  -webkit-backdrop-filter: var(--map-glass-blur);
  backdrop-filter: var(--map-glass-blur);
  border-right: 1px solid var(--map-glass-border);
  color: var(--map-text-primary);
  z-index: var(--map-z-overlay);
  overflow: hidden;
  flex-shrink: 0;
}

.map-sidebar.collapsed {
  width: 0;
  border-right-width: 0;
}

.sidebar-head {
  padding: 14px 16px 10px;
  border-bottom: 1px solid var(--map-glass-border);
  flex-shrink: 0;
}

.head-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--map-text-primary);
  margin-bottom: 12px;
  letter-spacing: 0.02em;
}

.filter-chips {
  display: flex;
  gap: 6px;
}

.chip {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 6px 10px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid transparent;
  border-radius: var(--map-radius-pill);
  color: var(--map-text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.18s ease, color 0.18s ease, border-color 0.18s ease;
}

.chip:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--map-text-primary);
}

.chip.active {
  background: var(--map-accent-soft);
  color: #fff;
  border-color: var(--map-accent-strong);
}

.chip-count {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.sidebar-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.entry-scroll {
  flex: 1;
  min-height: 0;
}

.entry-list {
  list-style: none;
  margin: 0;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.entry-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: var(--map-radius-md);
  cursor: pointer;
  transition: background 0.18s ease, transform 0.18s ease;
  border: 1px solid transparent;
}

.entry-item:hover,
.entry-item.hovered {
  background: rgba(255, 255, 255, 0.06);
  border-color: var(--map-glass-border-strong);
}

.entry-item.hovered {
  background: var(--map-accent-soft);
  border-color: var(--map-accent-strong);
}

.entry-thumb-wrap {
  position: relative;
  flex-shrink: 0;
  width: 56px;
  height: 56px;
  border-radius: var(--map-radius-sm);
  overflow: hidden;
  background: rgba(0, 0, 0, 0.4);
}

.entry-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.4s ease;
}

.entry-item:hover .entry-thumb,
.entry-item.hovered .entry-thumb {
  transform: scale(1.06);
}

.entry-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  min-width: 20px;
  height: 18px;
  padding: 0 5px;
  background: var(--map-accent-strong);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  border-radius: 9px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.85);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
}

.entry-type-pill {
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
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.18);
}

.entry-type-pill.video {
  background: color-mix(in srgb, var(--map-video) 75%, rgba(0, 0, 0, 0.6));
}

.entry-type-pill.image {
  background: color-mix(in srgb, var(--map-image) 75%, rgba(0, 0, 0, 0.6));
}

.entry-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.entry-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--map-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.entry-sub {
  font-size: 11px;
  color: var(--map-text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-variant-numeric: tabular-nums;
}

.entry-arrow {
  color: var(--map-text-tertiary);
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.entry-item:hover .entry-arrow,
.entry-item.hovered .entry-arrow {
  opacity: 1;
  transform: translateX(2px);
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--map-text-tertiary);
  padding: 32px 24px;
  text-align: center;
}

.empty-state p {
  margin: 0;
  font-size: 13px;
}

.empty-hint {
  font-size: 11px !important;
  color: var(--map-text-tertiary);
  opacity: 0.7;
}

.sidebar-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  border-top: 1px solid var(--map-glass-border);
  font-size: 11px;
  color: var(--map-text-tertiary);
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}

.foot-stat strong {
  color: var(--map-text-primary);
  font-weight: 600;
  margin-right: 2px;
}

.foot-zoom {
  text-transform: uppercase;
  font-size: 10px;
}
</style>

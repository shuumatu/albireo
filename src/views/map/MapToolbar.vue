<template>
  <div class="map-toolbar glass-panel">
    <n-tooltip placement="left" :show-arrow="false">
      <template #trigger>
        <button class="tool-btn" type="button" aria-label="放大" @click="$emit('zoomIn')">
          <n-icon :component="AddOutline" :size="18" />
        </button>
      </template>
      放大 (+)
    </n-tooltip>
    <n-tooltip placement="left" :show-arrow="false">
      <template #trigger>
        <button class="tool-btn" type="button" aria-label="缩小" @click="$emit('zoomOut')">
          <n-icon :component="RemoveOutline" :size="18" />
        </button>
      </template>
      缩小 (-)
    </n-tooltip>

    <div class="divider" role="separator" />

    <n-tooltip placement="left" :show-arrow="false">
      <template #trigger>
        <button class="tool-btn" type="button" aria-label="回到默认视图" @click="$emit('home')">
          <n-icon :component="LocateOutline" :size="18" />
        </button>
      </template>
      回到默认视图 (H)
    </n-tooltip>
    <n-tooltip placement="left" :show-arrow="false">
      <template #trigger>
        <button class="tool-btn" type="button" :aria-label="isFullscreen ? '退出全屏' : '全屏'" @click="$emit('fullscreen')">
          <n-icon :component="isFullscreen ? ContractOutline : ExpandOutline" :size="18" />
        </button>
      </template>
      {{ isFullscreen ? '退出全屏 (F)' : '全屏 (F)' }}
    </n-tooltip>
  </div>
</template>

<script setup lang="ts">
import { NIcon, NTooltip } from 'naive-ui'
import {
  AddOutline,
  RemoveOutline,
  LocateOutline,
  ExpandOutline,
  ContractOutline,
} from '@vicons/ionicons5'

withDefaults(
  defineProps<{
    isFullscreen?: boolean
  }>(),
  { isFullscreen: false },
)

defineEmits<{
  (e: 'zoomIn'): void
  (e: 'zoomOut'): void
  (e: 'home'): void
  (e: 'fullscreen'): void
}>()
</script>

<style scoped>
@import './mapTokens.css';

.map-toolbar {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 4px;
  border-radius: var(--map-radius-md);
}

.tool-btn {
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: var(--map-text-secondary);
  cursor: pointer;
  padding: 0;
  transition: background 0.18s ease, color 0.18s ease, transform 0.18s ease;
}

.tool-btn:hover {
  color: var(--map-text-primary);
  background: rgba(255, 255, 255, 0.08);
}

.tool-btn:active {
  transform: scale(0.92);
}

.tool-btn:focus-visible {
  outline: 2px solid var(--map-accent);
  outline-offset: 2px;
}

.divider {
  width: 24px;
  height: 1px;
  background: var(--map-glass-border-strong);
  margin: 4px 0;
}
</style>

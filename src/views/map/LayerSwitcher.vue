<template>
  <div class="layer-switcher glass-panel">
    <n-tooltip
      v-for="layer in baseLayers"
      :key="layer.id"
      placement="bottom"
      :show-arrow="false"
    >
      <template #trigger>
        <button
          type="button"
          class="layer-btn"
          :class="{ active: activeLayer === layer.id }"
          :aria-label="layer.name"
          :aria-pressed="activeLayer === layer.id"
          @click="$emit('switch', layer.id)"
        >
          <n-icon :component="layer.icon" :size="18" />
        </button>
      </template>
      {{ layer.name }}
    </n-tooltip>
  </div>
</template>

<script setup lang="ts">
import { NIcon, NTooltip } from 'naive-ui'
import type { Component } from 'vue'

export interface BaseLayerOption {
  id: string
  name: string
  icon: Component
}

defineProps<{
  baseLayers: BaseLayerOption[]
  activeLayer: string
}>()

defineEmits<{
  (e: 'switch', id: string): void
}>()
</script>

<style scoped>
@import './mapTokens.css';

.layer-switcher {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border-radius: var(--map-radius-pill);
}

.layer-btn {
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: var(--map-radius-pill);
  color: var(--map-text-secondary);
  cursor: pointer;
  padding: 0;
  transition: background 0.18s ease, color 0.18s ease, transform 0.18s ease;
}

.layer-btn:hover {
  color: var(--map-text-primary);
  background: rgba(255, 255, 255, 0.08);
}

.layer-btn:active {
  transform: scale(0.94);
}

.layer-btn.active {
  background: var(--map-accent-soft);
  color: #fff;
  box-shadow: inset 0 0 0 1px var(--map-accent-strong);
}

.layer-btn:focus-visible {
  outline: 2px solid var(--map-accent);
  outline-offset: 2px;
}
</style>

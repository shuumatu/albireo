<script setup lang="ts">
import { useTheme } from '../composables/useTheme'

const { currentTheme, setTheme } = useTheme()
</script>

<template>
  <div class="theme-toggle" role="group" aria-label="外观主题">
    <button
      type="button"
      class="theme-option theme-night"
      :aria-pressed="currentTheme === 'dark'"
      aria-label="黑暗模式"
      title="星夜 · 黑暗模式"
      @click="setTheme('dark')"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20.2 14A8.4 8.4 0 0 1 10 3.8 8.5 8.5 0 1 0 20.2 14Z" />
        <path class="star" d="M17.5 3v4M15.5 5h4" />
      </svg>
      <span>星夜</span>
    </button>
    <button
      type="button"
      class="theme-option theme-day"
      :aria-pressed="currentTheme === 'light'"
      aria-label="明亮模式"
      title="晴昼 · 明亮模式"
      @click="setTheme('light')"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="3.7" />
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
      <span>晴昼</span>
    </button>
  </div>
</template>

<style scoped>
.theme-toggle {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 3px;
  padding: 3px;
  border: 1px solid var(--line);
  border-radius: 24px;
  background: var(--surface);
}
.theme-option {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  gap: 6px;
  min-width: 65px;
  height: 32px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: 18px;
  background: transparent;
  color: var(--muted);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 1px;
  cursor: pointer;
  transition: color 180ms ease, background-color 180ms ease, border-color 180ms ease;
}
.theme-option svg {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.theme-option:hover {
  color: var(--text);
  background: var(--surface-raised);
}
.theme-option[aria-pressed='true'] {
  color: var(--accent);
  background: var(--accent-soft);
  border-color: color-mix(in srgb, var(--accent) 22%, transparent);
}
.theme-day[aria-pressed='true'] {
  color: var(--accent-warm);
  background: color-mix(in srgb, var(--accent-warm) 11%, var(--surface));
  border-color: color-mix(in srgb, var(--accent-warm) 22%, transparent);
}
.theme-option:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}
@media (max-width: 1200px) {
  .theme-option {
    min-width: 32px;
    padding: 0 8px;
  }
  .theme-option span {
    display: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .theme-option {
    transition: none;
  }
}
</style>

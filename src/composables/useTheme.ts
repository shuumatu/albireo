import { ref, watch } from 'vue'

export type ThemeMode = 'cosmic' | 'magic'

const THEME_KEY = 'video-detail-theme'

const currentTheme = ref<ThemeMode>(
  (localStorage.getItem(THEME_KEY) as ThemeMode) || 'cosmic'
)

export function useTheme() {
  function toggleTheme() {
    currentTheme.value = currentTheme.value === 'cosmic' ? 'magic' : 'cosmic'
  }

  function setTheme(theme: ThemeMode) {
    currentTheme.value = theme
  }

  watch(currentTheme, (val) => {
    localStorage.setItem(THEME_KEY, val)
  })

  return {
    currentTheme,
    toggleTheme,
    setTheme
  }
}

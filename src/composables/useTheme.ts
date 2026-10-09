import { computed, readonly, ref, watch } from 'vue'

export type ThemeMode = 'dark' | 'light'

const THEME_KEY = 'albireo-theme'

function readTheme(): ThemeMode {
  try {
    return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

// One shared state and one watcher for every switch, including standalone pages.
const currentTheme = ref<ThemeMode>(readTheme())
const isDark = computed(() => currentTheme.value === 'dark')
const stopWatching = watch(currentTheme, (theme) => {
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    'content', theme === 'dark' ? '#10151f' : '#f7f5ef'
  )
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    // Browsers with storage disabled can still switch for the current session.
  }
}, { immediate: true, flush: 'sync' })

function syncTheme(event: StorageEvent) {
  if (event.key === THEME_KEY || event.key === null) currentTheme.value = readTheme()
}
window.addEventListener('storage', syncTheme)
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    stopWatching()
    window.removeEventListener('storage', syncTheme)
  })
}

export function useTheme() {
  return {
    currentTheme: readonly(currentTheme),
    isDark,
    toggleTheme: () => { currentTheme.value = isDark.value ? 'light' : 'dark' },
    setTheme: (theme: ThemeMode) => { currentTheme.value = theme }
  }
}

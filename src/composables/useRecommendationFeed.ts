import { computed, onBeforeUnmount, ref, shallowRef } from 'vue'

/** Each home section owns its request, retry and last successful result. */
export function useRecommendationFeed<T>(
  initialValue: T,
  fetchData: (signal: AbortSignal) => Promise<T>,
  errorText: string
) {
  const data = shallowRef<T>(initialValue)
  const pending = ref(true)
  const hasLoaded = ref(false)
  const error = ref<string | null>(null)
  const refreshError = ref<string | null>(null)
  let controller: AbortController | undefined

  async function load() {
    controller?.abort()
    const current = new AbortController()
    controller = current
    pending.value = true
    error.value = null
    refreshError.value = null
    try {
      const result = await fetchData(current.signal)
      if (current.signal.aborted) return
      data.value = result
      hasLoaded.value = true
    } catch {
      if (current.signal.aborted) return
      if (hasLoaded.value) refreshError.value = '刷新未成功，仍显示上次加载的内容。'
      else error.value = errorText
    } finally {
      if (controller === current && !current.signal.aborted) pending.value = false
    }
  }

  onBeforeUnmount(() => controller?.abort())
  return {
    data, pending, error, refreshError, load,
    loading: computed(() => pending.value && !hasLoaded.value),
    refreshing: computed(() => pending.value && hasLoaded.value)
  }
}

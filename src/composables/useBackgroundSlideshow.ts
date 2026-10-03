import { computed, ref, shallowRef, watch, onScopeDispose, type Ref } from 'vue'
import { backgroundSource, normalizeBackgrounds } from '../utils/backgroundImages'
import type { BackgroundSlide, BackgroundPlaybackOptions } from '../types/background'

interface CachedImage {
  image: HTMLImageElement
  decoding: Promise<void> | null
  ready: boolean
}

// Keep the actual decoded nodes, not fulfilled promises for discarded Images.
// A fresh decode is required before every presentation: browsers may evict pixels.
export function useBackgroundSlideshow(
  input: Readonly<Ref<readonly BackgroundSlide[]>>,
  host: Ref<HTMLElement | undefined>,
  reduced: MediaQueryList,
  onDisplay: () => void,
  options: Readonly<Ref<BackgroundPlaybackOptions | undefined>> = ref(),
  onError?: (slide: BackgroundSlide) => void
) {
  const slides = computed(() => normalizeBackgrounds(input.value))
  const current = shallowRef<BackgroundSlide | null>(null)
  const active = computed(() => slides.value.findIndex((slide) => slide.id === current.value?.id))
  const busy = ref(false)
  const failure = ref(false)
  const front = shallowRef<HTMLImageElement>()
  const cache = new Map<string, CachedImage>()
  let desiredId: string | undefined
  let generation = 0
  let presentation = 0
  let stopped = false
  let paused = false
  let loading: CachedImage | undefined
  let warming: CachedImage | undefined
  let outgoing: HTMLImageElement | undefined
  let animation: Animation | undefined
  let transition: Promise<void> = Promise.resolve()
  let warmTimer: ReturnType<typeof setTimeout> | undefined
  let hoverTimer: ReturnType<typeof setTimeout> | undefined
  const decodeTimers = new Set<ReturnType<typeof setTimeout>>()

  const settings = computed(() => {
    const value = options.value ?? {}
    const number = (input: number | undefined, fallback: number, min = 0) =>
      typeof input === 'number' && Number.isFinite(input) ? Math.max(min, input) : fallback
    return {
      transitionMs: number(value.transitionMs, 240),
      hoverDelayMs: number(value.hoverDelayMs, 90),
      preloadNext: value.preloadNext !== false,
      preloadDelayMs: number(value.preloadDelayMs, 1200),
      decodeTimeoutMs: number(value.decodeTimeoutMs, 20000, 1),
      maxPixelRatio: number(value.maxPixelRatio, 2, 1)
    }
  })

  function source(index: number) {
    const rect = host.value!.getBoundingClientRect()
    return backgroundSource(slides.value[index]!, rect.width, rect.height,
      window.devicePixelRatio, settings.value.maxPixelRatio)
  }

  function discard(entry: CachedImage) {
    for (const [src, value] of cache) {
      if (value === entry) cache.delete(src)
    }
    entry.image.removeAttribute('src')
  }

  function trimCache() {
    for (const entry of cache.values()) {
      if (cache.size <= 3) break
      if (entry.image !== front.value && entry.image !== outgoing &&
          entry !== loading && entry !== warming) discard(entry)
    }
  }

  function getImage(src: string, priority: 'high' | 'low') {
    let entry = cache.get(src)
    if (entry) cache.delete(src)
    else {
      const image = new Image()
      image.decoding = 'async'
      image.draggable = false
      image.className = 'background-image'
      image.fetchPriority = priority
      image.src = src
      entry = { image, decoding: null, ready: false }
    }
    entry.image.fetchPriority = priority
    cache.set(src, entry)
    return entry
  }

  function decode(entry: CachedImage) {
    if (entry.decoding) return entry.decoding
    let timer: ReturnType<typeof setTimeout>
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Background image timed out')), settings.value.decodeTimeoutMs)
      decodeTimers.add(timer)
    })
    entry.decoding = Promise.race([entry.image.decode(), timeout])
      .then(() => { entry.ready = true })
      .finally(() => {
        clearTimeout(timer)
        decodeTimers.delete(timer)
        entry.decoding = null
      })
    return entry.decoding
  }

  function cancelHover() {
    clearTimeout(hoverTimer)
    hoverTimer = undefined
  }

  function cancelWarm(keep?: string) {
    clearTimeout(warmTimer)
    warmTimer = undefined
    if (warming && warming.image.getAttribute('src') !== keep) {
      if (!warming.ready) discard(warming)
      warming = undefined
    }
  }

  function scheduleWarm() {
    cancelWarm()
    // One neighbouring image after the selected frame settles, regardless of list size.
    const connection = (navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string }
    }).connection
    if (stopped || paused || !settings.value.preloadNext || slides.value.length < 2 ||
        document.hidden || connection?.saveData ||
        /(^|-)2g$/.test(connection?.effectiveType ?? '')) return
    warmTimer = setTimeout(async () => {
      warmTimer = undefined
      if (stopped || paused || busy.value || document.hidden || !host.value ||
          !settings.value.preloadNext || slides.value.length < 2 || active.value < 0) return
      const src = source((active.value + 1) % slides.value.length)
      if (cache.has(src)) return
      const entry = getImage(src, 'low')
      warming = entry
      trimCache()
      try {
        await decode(entry)
      } catch {
        // Speculative failure must never interrupt the visible frame.
        if (entry !== loading && entry.image !== front.value) discard(entry)
      } finally {
        if (warming === entry) warming = undefined
        trimCache()
      }
    }, settings.value.preloadDelayMs)
  }

  function present(entry: CachedImage, slide: BackgroundSlide) {
    const revision = ++presentation
    const image = entry.image
    const old = front.value
    image.alt = slide.alt ?? slide.title ?? ''
    image.removeAttribute('aria-hidden')
    image.classList.add('is-current')
    if (old) {
      old.classList.remove('is-current')
      old.setAttribute('aria-hidden', 'true')
    }
    // Insert this same node immediately after its decode, never a replacement img.
    host.value!.appendChild(image)
    outgoing = old
    front.value = image
    current.value = slide
    busy.value = false
    failure.value = false
    onDisplay()

    const finish = () => {
      if (revision !== presentation) return
      old?.remove()
      outgoing = undefined
      image.style.willChange = ''
      animation = undefined
      trimCache()
    }
    if (old && !reduced.matches && settings.value.transitionMs > 0) {
      image.style.willChange = 'opacity'
      animation = image.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: settings.value.transitionMs, easing: 'ease-out'
      })
      transition = animation.finished.catch(() => {}).then(finish)
    } else {
      finish()
      transition = Promise.resolve()
    }
    void transition.then(() => {
      if (revision === presentation && !busy.value && !stopped && !paused) scheduleWarm()
    })
  }

  async function select(index: number, force = false) {
    cancelHover()
    const slide = slides.value[index]
    if (stopped || paused || !host.value || !slide) return
    const src = source(index)
    if (!force && busy.value && desiredId === slide.id && loading?.image.getAttribute('src') === src) return
    const id = ++generation
    desiredId = slide.id
    cancelWarm(src)
    if (loading && loading.image.getAttribute('src') !== src) {
      if (!loading.ready && loading.image !== front.value) discard(loading)
      loading = undefined
    }
    failure.value = false
    if (front.value?.getAttribute('src') === src) {
      front.value.alt = slide.alt ?? slide.title ?? ''
      current.value = slide
      busy.value = false
      scheduleWarm()
      return
    }
    busy.value = true
    const entry = getImage(src, 'high')
    loading = entry
    trimCache()
    try {
      // Serialize fades, but allow the latest image's transfer to start meanwhile.
      // Decode AFTER that wait so decoded data is available for the display frame.
      await transition
      if (id !== generation || stopped) return
      await decode(entry)
      if (id !== generation || stopped || !host.value) return
      loading = undefined
      if (warming === entry) warming = undefined
      present(entry, slide)
    } catch {
      if (id !== generation || stopped) return
      discard(entry)
      loading = undefined
      busy.value = false
      failure.value = true
      onError?.(slide)
    }
  }

  function hover(index: number) {
    cancelHover()
    const id = slides.value[index]?.id
    hoverTimer = setTimeout(() => {
      void select(slides.value.findIndex((slide) => slide.id === id))
    }, settings.value.hoverDelayMs)
  }

  function pause() {
    paused = true
    ++generation
    cancelHover()
    cancelWarm()
    if (loading && !loading.ready && loading.image !== front.value) discard(loading)
    loading = undefined
    busy.value = false
    animation?.finish()
  }

  function clear() {
    ++generation
    ++presentation
    cancelHover()
    cancelWarm()
    animation?.cancel()
    animation = undefined
    transition = Promise.resolve()
    outgoing = undefined
    loading = undefined
    for (const entry of cache.values()) discard(entry)
    for (const timer of decodeTimers) clearTimeout(timer)
    decodeTimers.clear()
    host.value?.replaceChildren()
    front.value = undefined
    current.value = null
    desiredId = undefined
    busy.value = false
    failure.value = false
  }

  function refresh(force = false) {
    if (stopped) return
    if (!slides.value.length) {
      clear()
      return
    }
    // Preserve selection by identity across reorder, metadata edits and URL updates.
    const desired = slides.value.findIndex((slide) => slide.id === desiredId)
    const index = desired >= 0 ? desired : active.value >= 0 ? active.value : 0
    desiredId = slides.value[index]!.id
    return select(index, force)
  }

  function stop() {
    if (stopped) return
    stopped = true
    paused = true
    clear()
  }

  watch(slides, () => { void refresh(true) })
  watch(settings, () => { void refresh(true) })
  onScopeDispose(stop)

  return {
    slides, current, active, busy, failure, front, select, hover, cancelHover, pause, stop,
    refresh,
    resume: () => {
      paused = false
      return refresh()
    },
    retry: () => refresh(true)
  }
}

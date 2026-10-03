import { createApp, h, ref } from 'vue'
import BackgroundSlideshow from '../../src/components/BackgroundSlideshow.vue'
import type { BackgroundSlide, BackgroundPlaybackOptions } from '../../src/types/background'

type Owner = 'primary' | 'secondary'
declare global {
  interface Window {
    backgroundTest: {
      setSlides: (owner: Owner, slides: BackgroundSlide[]) => void
      select: (owner: Owner, id: string) => void
      events: { owner: Owner; kind: 'change' | 'error'; id: string | null }[]
    }
    releaseBackground: (src: string) => void
    heldBackgrounds: string[]
  }
}

createApp({
  setup() {
    const primary = ref<BackgroundSlide[]>([])
    const secondary = ref<BackgroundSlide[]>([])
    const handles = new Map<Owner, InstanceType<typeof BackgroundSlideshow>>()
    const events: Window['backgroundTest']['events'] = []
    const playback: BackgroundPlaybackOptions = { preloadNext: false }
    window.backgroundTest = {
      setSlides: (owner, slides) => { (owner === 'primary' ? primary : secondary).value = slides },
      select: (owner, id) => handles.get(owner)?.select(id),
      events
    }
    const render = (owner: Owner, slides: BackgroundSlide[]) => h('section', { id: owner }, [
      h(BackgroundSlideshow, {
        ref: (instance) => { if (instance) handles.set(owner, instance as InstanceType<typeof BackgroundSlideshow>) },
        slides, playback, panEnabled: false, label: owner,
        style: { height: '320px', marginBottom: '12px' },
        onChange: (slide) => events.push({ owner, kind: 'change', id: slide?.id ?? null }),
        onError: (slide) => events.push({ owner, kind: 'error', id: slide.id })
      }, {
        default: ({ slides, current, active, select }) => h('div', { style: { color: 'white' } }, [
          h('span', { 'data-current': '' }, current?.id ?? 'empty'),
          h('span', { 'data-title': '' }, current?.title ?? ''),
          h('span', { 'data-index': '' }, String(active)),
          ...slides.map((slide, index) => h('button', {
            'data-select': slide.id, onClick: () => select(index)
          }, slide.title || slide.id))
        ]),
        empty: () => h('span', { 'data-empty': '' }, 'No backgrounds')
      })
    ])
    return () => [render('primary', primary.value), render('secondary', secondary.value)]
  }
}).mount('#app')

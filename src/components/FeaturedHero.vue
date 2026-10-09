<script setup lang="ts">
import BackgroundSlideshow from './BackgroundSlideshow.vue'
import type { BackgroundSlide, BackgroundPlaybackOptions } from '../types/background'

const props = withDefaults(defineProps<{
  slides: readonly BackgroundSlide[]
  playback?: BackgroundPlaybackOptions
  exploreTarget?: string
}>(), { exploreTarget: 'selected' })
const emit = defineEmits<{
  change: [slide: BackgroundSlide | null]
  error: [slide: BackgroundSlide]
}>()
function explore(event: MouseEvent) {
  event.preventDefault()
  const target = document.getElementById(props.exploreTarget)
  target?.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
  })
  target?.focus({ preventScroll: true })
}
</script>
<template>
  <section class="featured-hero" aria-label="精选画面">
    <BackgroundSlideshow
      class="hero" :slides="slides" :playback="playback" label="全景照片"
      @change="emit('change', $event)" @error="emit('error', $event)"
      v-slot="{ slides, current, active, select, hover, cancelHover }"
    >
      <div class="hero-shade" aria-hidden="true"></div>
      <div v-if="current" class="hero-bottom">
        <div class="hero-caption">
          <span v-if="active >= 0" class="mono muted"
            >FEATURED / {{ String(active + 1).padStart(3, '0') }}</span
          >
          <h2>{{ current.title }}</h2>
          <span class="image-label">{{ current.type }}</span>
        </div>
        <div class="selector-dock">
          <div
            class="slide-controls"
            role="group"
            aria-label="悬停、聚焦或轻触切换画面"
          >
            <button
              v-for="(slide, index) in slides"
              :key="slide.id"
              :aria-label="`查看${slide.title || `背景 ${index + 1}`}`"
              :aria-pressed="active === index"
              @pointerenter="hover($event, index)"
              @pointerleave="cancelHover"
              @focus="select(index)"
              @click="select(index)"
            >
              <i class="selector-mark" aria-hidden="true"></i>
            </button>
          </div>
          <div
            v-if="active >= 0"
            class="frame-count mono"
            :aria-label="`当前第 ${active + 1} 张，共 ${slides.length} 张`"
          >
            <span class="slide-number">{{
              String(active + 1).padStart(2, '0')
            }}</span
            ><span class="frame-total" aria-hidden="true"
              >/ {{ String(slides.length).padStart(2, '0') }}</span
            >
          </div>
        </div>
        <a class="scroll-link mono" :href="`#${exploreTarget}`" @click="explore"
          >SCROLL TO EXPLORE <span aria-hidden="true">↓</span></a
        >
      </div>
    </BackgroundSlideshow>
  </section>
</template>
<style scoped>
.featured-hero {
  container-type: inline-size;
}
.hero-shade {
  position: absolute;
  inset: 0;
  z-index: -2;
}
.hero-bottom {
  position: absolute;
  color: var(--on-photo);
  --accent: var(--on-photo-blue);
  --accent-warm: var(--on-photo-gold);
}
.mono {
  font-family: var(--mono);
}
.image-label {
  font-size: 11px;
  color: #aebbc1;
}
.hero-caption > .mono {
  font-size: 10px;
  letter-spacing: 1px;
}
.hero-bottom .scroll-link {
  font-size: 10px;
  letter-spacing: 1px;
}
.scroll-link span {
  font-size: 25px;
}
.hero {
  height: clamp(480px, calc(100svh - var(--header-height)), 880px);
}
.hero-shade {
  background: linear-gradient(
    0deg,
    #061017b8 0%,
    #06101726 22%,
    transparent 42%
  );
  pointer-events: none;
}
.hero-bottom {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  z-index: 2;
  bottom: 42px;
  left: 8%;
  right: 8%;
  align-items: center;
  gap: 32px;
}
.hero-caption {
  min-width: 0;
  text-shadow: 0 1px 8px #0008;
}
.hero-caption > .mono {
  color: var(--on-photo-gold);
}
.hero-bottom h2 {
  margin: 9px 0 8px;
  font-size: 21px;
  font-weight: 650;
  letter-spacing: 2px;
  overflow-wrap: anywhere;
}
.hero-bottom .scroll-link {
  display: flex;
  min-height: 44px;
  white-space: nowrap;
  margin-left: 8px;
  gap: 14px;
  color: #d6dfe3;
  text-shadow: 0 1px 8px #0008;
}
.hero-bottom .scroll-link span {
  transition: transform 0.18s;
}
.hero-bottom .scroll-link:is(:hover, :focus-visible) {
  color: var(--accent);
}
.hero-bottom .scroll-link:is(:hover, :focus-visible) span {
  transform: translateY(3px);
}
.selector-dock {
  display: flex;
  align-items: center;
  gap: 30px;
  flex-shrink: 0;
}
.slide-controls {
  position: relative;
  display: flex;
  gap: 4px;
  margin: 0;
  width: auto;
  flex-shrink: 0;
}
.slide-controls button {
  position: relative;
  display: grid;
  place-items: center;
  flex: 0 0 44px;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 0;
  background: transparent;
  border-radius: 0;
}
.slide-controls button:before {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: 28px;
  height: 32px;
  background: linear-gradient(90deg, var(--star-blue-soft), #80b5f408);
  opacity: 0;
  transform: translate(-50%, -50%) skewX(-24deg) scaleY(0.7);
  transition:
    opacity 0.2s,
    transform 0.22s;
  pointer-events: none;
}
.slide-controls button:after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  width: 16px;
  height: 1px;
  background: var(--accent-warm);
  opacity: 0;
  transform: translateX(-50%) scaleX(0.4);
  transition:
    opacity 0.2s,
    transform 0.22s;
  pointer-events: none;
}
.slide-controls .selector-mark {
  position: relative;
  display: block;
  width: 3px;
  height: 18px;
  transform: skewX(-24deg);
  background: #d4e2f5a6;
  transition:
    width 0.22s cubic-bezier(0.2, 0.7, 0.2, 1),
    height 0.22s,
    background 0.18s;
  pointer-events: none;
}
.slide-controls button[aria-pressed='true']:before {
  opacity: 1;
  transform: translate(-50%, -50%) skewX(-24deg) scaleY(1);
}
.slide-controls button[aria-pressed='true'] .selector-mark {
  width: 18px;
  height: 24px;
  background: linear-gradient(
    90deg,
    var(--on-photo-gold) 0 2px,
    transparent 2px 5px,
    var(--accent) 5px
  );
}
.slide-controls button[aria-pressed='true']:after {
  opacity: 0.8;
  transform: translateX(-50%) scaleX(1);
}
.slide-controls button:focus-visible {
  outline-offset: 2px;
}
.slide-controls button:focus-visible .selector-mark {
  width: 8px;
  height: 22px;
  background-color: var(--accent);
}
.slide-controls button[aria-pressed='true']:focus-visible .selector-mark {
  width: 18px;
  height: 24px;
}
@media (any-hover: hover) {
  .slide-controls button:hover:before {
    opacity: 1;
    transform: translate(-50%, -50%) skewX(-24deg) scaleY(1);
  }
  .slide-controls button:hover .selector-mark {
    width: 8px;
    height: 22px;
    background-color: var(--accent);
  }
  .slide-controls button[aria-pressed='true']:hover .selector-mark {
    width: 18px;
    height: 24px;
  }
}
.hero-bottom .frame-count {
  display: flex;
  align-items: baseline;
  gap: 12px;
  font-size: 48px;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0;
  white-space: nowrap;
  text-shadow: 0 1px 8px #0008;
}
.frame-count .slide-number {
  font-family: Arial, sans-serif;
  font-weight: 700;
  letter-spacing: -2px;
  color: var(--accent-warm);
}
.frame-count .frame-total {
  font-size: 12px;
  color: #d6dfe3;
}

@container (max-width:900px) {
  .hero-bottom {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 12px 18px;
  }
  .hero-bottom .scroll-link {
    grid-column: 2;
    grid-row: 1;
    margin-left: 0;
  }
  .selector-dock {
    grid-column: 1 / -1;
    grid-row: 2;
    justify-content: space-between;
  }
}
@container (max-width:650px) {
  .hero {
    height: clamp(480px, 72svh, 680px);
  }
  .hero-bottom {
    left: 24px;
    right: 24px;
    bottom: 24px;
    gap: 8px 14px;
  }
  .hero-bottom h2 {
    font-size: 19px;
    letter-spacing: 1px;
  }
  .hero-caption > .mono {
    font-size: 9px;
  }
  .selector-dock {
    gap: 12px;
  }
  .slide-controls {
    margin-left: -12px;
    gap: 0;
  }
  .hero-bottom .frame-count {
    font-size: 36px;
    gap: 9px;
  }
  .frame-count .slide-number {
    letter-spacing: -1px;
  }
  .frame-count .frame-total {
    font-size: 11px;
  }
}
@container (max-width:400px) {
  .slide-controls button {
    flex-basis: 36px;
    width: 36px;
  }
  .hero-bottom .frame-count {
    font-size: 32px;
    gap: 6px;
  }
}
</style>

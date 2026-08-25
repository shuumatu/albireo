<template>
  <div class="main-page">
    <!-- Hero 区域：保留原有背景轮播 -->
    <div
      class="hero-section background-container"
      ref="bgContainer"
      @mousemove="handleMouseMove"
      @mouseleave="stopMoving"
    >
      <!-- 背景图部分 -->
      <div class="bg-images">
        <img
          v-for="(dot, index) in dots"
          :key="dot.bg"
          :src="dot.bg"
          class="moving-bg"
          :class="{ 'is-active': dot.bg === currentBg }"
          loading="eager"
          ref="bgImgRefs"
        />
      </div>

      <!-- 左右箭头 -->
      <img
        class="arrow left-arrow"
        :class="{ visible: showLeftArrow }"
        src="../assets/icon/KeyboardArrowLeftTwotone.svg"
        alt="←"
      />
      <img
        class="arrow right-arrow"
        :class="{ visible: showRightArrow }"
        src="../assets/icon/KeyboardArrowRightTwotone.svg"
        alt="→"
      />

      <!-- 底部圆点 -->
      <div class="trigger-area" @mouseenter="showDots" @mouseleave="hideDots">
        <div class="dots-container">
          <div
            v-for="(dot, index) in dots"
            :key="index"
            class="dot"
            v-motion="`dot-${index}`"
            @mouseenter="handleDotHover(index)"
            @mouseleave="handleDotLeave(index)"
          />
        </div>
      </div>

      <!-- 滚动到推荐区指示器 -->
      <button class="scroll-indicator" @click="scrollToRecommend" aria-label="向下浏览推荐内容">
        <span class="indicator-text">探索作品</span>
        <span class="indicator-arrow">↓</span>
      </button>
    </div>

    <!-- 推荐区 -->
    <div ref="recommendArea" class="recommend-area">
      <RecommendSection
        title="热门作品"
        :subtitle="hotSubtitle"
        :loading="hotLoading"
        :error="hotError"
        :has-items="hotItems.length > 0"
        empty-text="暂无热门内容"
        @retry="loadHot"
      >
        <MediaCard
          v-for="item in hotItems"
          :key="`hot-${item.itemType}-${item.id}`"
          :item="item"
        />
      </RecommendSection>

      <RecommendSection
        title="推荐作品"
        subtitle="精心挑选的得意之作"
        :loading="featuredLoading"
        :error="featuredError"
        :has-items="featuredItems.length > 0"
        empty-text="暂无推荐作品"
        @retry="loadFeatured"
      >
        <MediaCard
          v-for="item in featuredItems"
          :key="`featured-${item.itemType}-${item.id}`"
          :item="item"
        />
      </RecommendSection>

      <RecommendSection
        title="旅途回忆"
        subtitle="同一时间、同一地点拍下的回忆"
        :loading="tripLoading"
        :error="tripError"
        :has-items="tripItems.length > 0"
        empty-text="暂无足够带 GPS 信息的内容"
        @retry="loadTrips"
      >
        <TripCard
          v-for="trip in tripItems"
          :key="`trip-${trip.tripId}`"
          :trip="trip"
        />
      </RecommendSection>

      <footer class="page-footer">
        <span>© {{ new Date().getFullYear() }} shuumatu</span>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { useMotions } from '@vueuse/motion'
import RecommendSection from '../components/RecommendSection.vue'
import MediaCard from '../components/MediaCard.vue'
import TripCard from '../components/TripCard.vue'
import {
  getHotRecommend,
  getFeaturedRecommend,
  getTripsRecommend,
  type RecommendItemVO,
  type TopicInfo,
  type TripVO
} from '../api/recommend'

// ================== Hero 轮播逻辑（保持原有） ==================
const bgImgRefs = ref<HTMLImageElement[]>([])
const motions = useMotions()

const variants = {
  hidden: {
    opacity: 0,
    y: 20,
    scale: 0.5,
    backgroundColor: '#ffffff',
    transition: {
      duration: 250,
      ease: 'easeIn'
    }
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    backgroundColor: '#ffffff',
    transition: {
      duration: 350,
      delay: (i: number) => i * 80,
      ease: 'easeOut'
    }
  },
  hang: {
    opacity: 1,
    y: -10,
    scale: 1.1,
    backgroundColor: '#7474747d',
    transition: {
      duration: 200,
      ease: 'easeOut'
    }
  }
}

onMounted(() => {
  dots.value.forEach((_, i) => {
    motions[`dot-${i}`].apply({
      ...variants.hidden,
      x: i * 0
    })
  })
})

const showDots = () => {
  dots.value.forEach((_, i) => {
    motions[`dot-${i}`].apply({
      ...variants.visible,
      transition: {
        ...variants.visible.transition,
        delay: i * 80
      }
    })
  })
}

const hideDots = () => {
  dots.value.forEach((_, i) => {
    motions[`dot-${i}`].apply(variants.hidden)
  })
}

const handleDotHover = (index: number) => {
  motions[`dot-${index}`].apply(variants.hang)
  const pos = `${backgroundX}% center`
  bgImgRefs.value.forEach(img => {
    img.style.objectPosition = pos
  })
  activeIndex = index
  currentBg.value = dots.value[index].bg
}

const handleDotLeave = (index: number) => {
  motions[`dot-${index}`].apply({
    ...variants.visible,
    transition: {
      duration: 200,
      ease: 'easeIn'
    }
  })
}

const dots = ref([
  { bg: new URL('../assets/bg1.jpg', import.meta.url).href },
  { bg: new URL('../assets/bg2.jpg', import.meta.url).href },
  { bg: new URL('../assets/bg3.jpg', import.meta.url).href },
  { bg: new URL('../assets/bg4.jpg', import.meta.url).href },
  { bg: new URL('../assets/bg5.jpg', import.meta.url).href }
])

const defaultBg = new URL('../assets/bg4.jpg', import.meta.url).href
const currentBg = ref(defaultBg)

onMounted(() => {
  bgImgRefs.value.forEach(img => {
    img.decode().catch(() => {})
  })
})

const bgContainer = ref<HTMLElement | null>(null)
let backgroundX = 50
let activeIndex = dots.value.findIndex(d => d.bg === defaultBg)
const showLeftArrow = ref(false)
const showRightArrow = ref(false)

let speed = 0
let animationFrameId: number | null = null
let cachedRect: DOMRect | null = null

function updateCachedRect() {
  const el = bgContainer.value
  if (el) cachedRect = el.getBoundingClientRect()
}

function handleMouseMove(e: MouseEvent) {
  if (!cachedRect) return
  const ratio = (e.clientX - cachedRect.left) / cachedRect.width

  if (ratio > 0.25 && ratio < 0.75) {
    speed = 0
    showLeftArrow.value = false
    showRightArrow.value = false
    return
  }

  const distanceFromCenter = ratio - 0.5
  speed = Math.sign(distanceFromCenter) * Math.pow(Math.abs(distanceFromCenter), 5) * 15

  showLeftArrow.value = ratio <= 0.25
  showRightArrow.value = ratio >= 0.75

  startMoving()
}

function stopMoving() {
  speed = 0
  showLeftArrow.value = false
  showRightArrow.value = false
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }
}

function startMoving() {
  if (animationFrameId !== null) return

  const animate = () => {
    if (speed !== 0) {
      backgroundX += speed
      backgroundX = Math.max(0, Math.min(100, backgroundX))
      const activeImg = bgImgRefs.value[activeIndex]
      if (activeImg) activeImg.style.objectPosition = `${backgroundX}% center`
      animationFrameId = requestAnimationFrame(animate)
    } else {
      animationFrameId = null
    }
  }

  animate()
}

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  updateCachedRect()
  resizeObserver = new ResizeObserver(updateCachedRect)
  if (bgContainer.value) resizeObserver.observe(bgContainer.value)
})

onBeforeUnmount(() => {
  if (animationFrameId !== null) cancelAnimationFrame(animationFrameId)
  resizeObserver?.disconnect()
})

// ================== 推荐数据加载 ==================
const RECOMMEND_LIMIT = 12

const hotItems = ref<RecommendItemVO[]>([])
const hotTopic = ref<TopicInfo | null>(null)
const hotLoading = ref(true)
const hotError = ref<string | null>(null)

const featuredItems = ref<RecommendItemVO[]>([])
const featuredLoading = ref(true)
const featuredError = ref<string | null>(null)

const TRIP_LIMIT = 6
const tripItems = ref<TripVO[]>([])
const tripLoading = ref(true)
const tripError = ref<string | null>(null)

const hotSubtitle = computed(() => {
  if (hotTopic.value && hotTopic.value.tagName) {
    return `本月主题 · #${hotTopic.value.tagName}`
  }
  return '近期最受欢迎的图片与视频'
})

async function loadHot() {
  hotLoading.value = true
  hotError.value = null
  try {
    const result = await getHotRecommend(RECOMMEND_LIMIT)
    hotItems.value = result.items || []
    hotTopic.value = result.currentTopic
  } catch (e: any) {
    hotError.value = e?.message || '加载失败'
  } finally {
    hotLoading.value = false
  }
}

async function loadFeatured() {
  featuredLoading.value = true
  featuredError.value = null
  try {
    featuredItems.value = await getFeaturedRecommend(RECOMMEND_LIMIT)
  } catch (e: any) {
    featuredError.value = e?.message || '加载失败'
  } finally {
    featuredLoading.value = false
  }
}

async function loadTrips() {
  tripLoading.value = true
  tripError.value = null
  try {
    tripItems.value = await getTripsRecommend(TRIP_LIMIT)
  } catch (e: any) {
    tripError.value = e?.message || '加载失败'
  } finally {
    tripLoading.value = false
  }
}

onMounted(() => {
  // 并发拉取，让 3 个推荐区同时开始加载
  loadHot()
  loadFeatured()
  loadTrips()
})

// ================== 滚动到推荐区 ==================
const recommendArea = ref<HTMLElement | null>(null)

function scrollToRecommend() {
  const el = recommendArea.value
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<style scoped>
.main-page {
  width: 100%;
  display: flex;
  flex-direction: column;
}

/* Hero 区域：占满首屏 */
.hero-section {
  position: relative;
  width: 100%;
  height: calc(100vh - 64px);
  overflow: hidden;
  flex-shrink: 0;
}

.bg-images {
  width: 100%;
  height: 100%;
  position: relative;
  z-index: 0;
}

.moving-bg {
  position: absolute;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 50% center;
  top: 0;
  left: 0;
  transition: opacity 0.6s ease;
  pointer-events: none;
  opacity: 0;
  z-index: 0;
  transform: translateZ(0);
  contain: layout style;
}

.moving-bg.is-active {
  opacity: 1;
  z-index: 1;
}

.arrow {
  filter: brightness(0) invert(1);
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 100px;
  opacity: 0;
  pointer-events: none;
  z-index: 2;
  transition: opacity 0.2s ease;
}

.arrow.visible {
  opacity: 0.7;
}

.left-arrow {
  left: 20px;
}
.right-arrow {
  right: 20px;
}

.trigger-area {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: min(90%, 500px);
  height: 175px;
  z-index: 10;
}

.dots-container {
  position: absolute;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 60px;
}

.dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background-color: white;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

/* 滚动指示器 */
.scroll-indicator {
  position: absolute;
  bottom: 20px;
  right: 24px;
  z-index: 11;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 14px;
  background-color: rgba(0, 0, 0, 0.32);
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 22px;
  color: white;
  font-size: 12px;
  letter-spacing: 1px;
  cursor: pointer;
  backdrop-filter: blur(6px);
  transition: background-color 0.25s ease, transform 0.25s ease;
}

.scroll-indicator:hover {
  background-color: rgba(0, 0, 0, 0.55);
  transform: translateY(-2px);
}

.indicator-arrow {
  font-size: 14px;
  animation: bounce 2s ease-in-out infinite;
}

@keyframes bounce {
  0%, 100% {
    transform: translateY(0);
    opacity: 0.7;
  }
  50% {
    transform: translateY(4px);
    opacity: 1;
  }
}

/* 推荐区 */
.recommend-area {
  width: 100%;
  background-color: #0a0a0a;
  padding: 24px 0 12px;
}

.page-footer {
  padding: 32px;
  text-align: center;
  color: rgba(255, 255, 255, 0.3);
  font-size: 12px;
  letter-spacing: 1px;
}

@media (max-width: 768px) {
  .scroll-indicator {
    bottom: 16px;
    right: 16px;
    padding: 6px 12px;
    font-size: 11px;
  }
}
</style>

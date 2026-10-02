<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import FeaturedHero from '../components/FeaturedHero.vue'
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
const hotItems = ref<RecommendItemVO[]>([]),
  featuredItems = ref<RecommendItemVO[]>([]),
  tripItems = ref<TripVO[]>([]),
  hotTopic = ref<TopicInfo | null>(null)
const hotLoading = ref(true),
  featuredLoading = ref(true),
  tripLoading = ref(true)
const hotError = ref<string | null>(null),
  featuredError = ref<string | null>(null),
  tripError = ref<string | null>(null)
const hotSubtitle = computed(() =>
  hotTopic.value
    ? `正在被看见 · ${hotTopic.value.tagName}`
    : '那些被喜欢、被记住的瞬间'
)
async function loadHot() {
  hotLoading.value = true
  hotError.value = null
  try {
    const r = await getHotRecommend(12)
    hotItems.value = r.items || []
    hotTopic.value = r.currentTopic
  } catch {
    hotError.value = '暂时无法加载作品，请稍后重试'
  } finally {
    hotLoading.value = false
  }
}
async function loadFeatured() {
  featuredLoading.value = true
  featuredError.value = null
  try {
    featuredItems.value = (await getFeaturedRecommend(12)) || []
  } catch {
    featuredError.value = '暂时无法加载精选，请稍后重试'
  } finally {
    featuredLoading.value = false
  }
}
async function loadTrips() {
  tripLoading.value = true
  tripError.value = null
  try {
    tripItems.value = (await getTripsRecommend(6)) || []
  } catch {
    tripError.value = '暂时无法加载旅途，请稍后重试'
  } finally {
    tripLoading.value = false
  }
}
onMounted(() => {
  void loadHot()
  void loadFeatured()
  void loadTrips()
})
</script>
<template>
  <div class="home-page">
    <FeaturedHero />
    <section id="selected" class="selected-area" tabindex="-1">
      <div class="collection-intro">
        <div>
          <span class="archive-eyebrow">PERSONAL VISUAL ARCHIVE</span>
          <h1>世界的切片，<br />时间的存档。</h1>
          <p>沿着光的方向，收集那些值得记住的瞬间。</p>
        </div>
        <div class="chapter-orbit" aria-hidden="true">
          <small>SELECTED</small><strong>01</strong>
        </div>
      </div>
      <RecommendSection
        title="精选影像"
        eyebrow="01 / SELECTED WORKS"
        subtitle="每一帧，都有来处。"
        :loading="featuredLoading"
        :error="featuredError"
        :has-items="featuredItems.length > 0"
        empty-text="精选影像正在整理，先沿时间线逛逛。"
        @retry="loadFeatured"
        ><MediaCard
          v-for="item in featuredItems"
          :key="`${item.itemType}-${item.id}`"
          :item="item"
      /></RecommendSection>
      <router-link to="/timeline" class="section-link"
        >浏览时间线 <span>↗</span></router-link
      >
      <div class="journey-intro">
        <div>
          <span class="archive-eyebrow">02 / ON THE ROAD</span>
          <h2>让足迹，串起回忆。</h2>
        </div>
        <p>从一张照片出发，<br />重新走进那一段旅途。</p>
        <router-link to="/map" class="archive-action primary"
          >探索旅途地图 ↗</router-link
        >
      </div>
      <RecommendSection
        title="旅途回忆"
        subtitle="时间、地点与沿途的故事"
        :loading="tripLoading"
        :error="tripError"
        :has-items="tripItems.length > 0"
        empty-text="还没有可以展示的旅途，新的足迹正在路上。"
        @retry="loadTrips"
        ><TripCard v-for="trip in tripItems" :key="trip.tripId" :trip="trip"
      /></RecommendSection>
    </section>
    <section class="popular-area">
      <RecommendSection
        title="热门作品"
        eyebrow="03 / IN FOCUS"
        :subtitle="hotSubtitle"
        :loading="hotLoading"
        :error="hotError"
        :has-items="hotItems.length > 0"
        empty-text="还没有热门作品，去时间线发现更多影像。"
        @retry="loadHot"
        ><MediaCard
          v-for="item in hotItems"
          :key="`${item.itemType}-${item.id}`"
          :item="item"
      /></RecommendSection>
    </section>
  </div>
</template>
<style scoped>
.selected-area {
  background: var(--paper);
  color: var(--paper-ink);
  padding: 64px 8% 56px;
  scroll-margin-top: 24px;
  --text: var(--paper-ink);
  --muted: var(--paper-muted);
  --surface: #e5e0d5;
  --surface-raised: #e0e5ea;
  --line: #b3b7ba;
  --accent: var(--paper-blue);
  --accent-warm: var(--paper-gold);
  --accent-soft: rgba(44, 96, 151, 0.1);
  --accent-warm-soft: rgba(128, 89, 29, 0.1);
}
.selected-area:focus {
  outline: none;
}
.collection-intro {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 44px;
  border-bottom: 1px solid var(--line);
  margin-bottom: 20px;
  gap: 30px;
  position: relative;
}
.collection-intro:after {
  content: '';
  position: absolute;
  bottom: -3px;
  right: 0;
  width: 108px;
  height: 5px;
  background: repeating-linear-gradient(
    90deg,
    var(--accent) 0 1px,
    transparent 1px 9px
  );
}
h1 {
  font-size: 40px;
  line-height: 1.35;
  letter-spacing: 2px;
  margin: 20px 0;
}
p {
  color: var(--muted);
  font-size: 14px;
  line-height: 1.8;
}
.chapter-orbit {
  width: 150px;
  height: 150px;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 1px solid #2c609740;
  border-radius: 50%;
  color: var(--accent);
  margin-right: 16px;
  flex-shrink: 0;
}
.chapter-orbit:before {
  content: '';
  position: absolute;
  inset: 9px;
  border: 1px solid #80591d80;
  border-left-color: transparent;
  border-right-color: transparent;
  border-radius: 50%;
  transform: rotate(-24deg);
}
.chapter-orbit:after {
  content: '+';
  position: absolute;
  right: -6px;
  font: 17px var(--mono);
  color: var(--accent-warm);
}
.chapter-orbit small {
  font: 9px var(--mono);
  letter-spacing: 2px;
  color: var(--accent-warm);
}
.chapter-orbit strong {
  font: 64px Arial;
}
.section-link {
  display: flex;
  align-items: center;
  gap: 24px;
  width: fit-content;
  margin-left: auto;
  min-height: 44px;
  font-size: 14px;
  border-bottom: 1px solid;
  color: var(--accent);
}
.section-link:hover {
  color: var(--accent-warm);
}
.journey-intro {
  border-top: 1px solid var(--line);
  padding-top: 36px;
  margin-top: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}
.journey-intro h2 {
  font-size: 28px;
  margin: 12px 0;
}
.popular-area {
  padding: 32px 8% 56px;
}
@media (max-width: 700px) {
  .selected-area {
    padding: 40px 24px;
  }
  .chapter-orbit {
    display: none;
  }
  h1 {
    font-size: 30px;
  }
  .collection-intro {
    padding-bottom: 28px;
  }
  .journey-intro {
    margin-top: 40px;
    align-items: start;
    flex-direction: column;
  }
  .journey-intro p {
    display: none;
  }
  .popular-area {
    padding: 24px;
  }
  .journey-intro h2 {
    font-size: 24px;
  }
}
</style>

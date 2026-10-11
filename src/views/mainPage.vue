<script setup lang="ts">
import { onMounted } from 'vue'
import FeaturedHero from '../components/FeaturedHero.vue'
import { heroSlides } from '../utils/heroSources'
import RecommendSection from '../components/RecommendSection.vue'
import HomeMediaSection from '../components/HomeMediaSection.vue'
import TripCard from '../components/TripCard.vue'
import { useRecommendationFeed } from '../composables/useRecommendationFeed'
import {
  getHotRecommend,
  getFeaturedRecommend,
  getTripsRecommend,
  type RecommendItemVO,
  type HotRecommendVO,
  type TripVO
} from '../api/recommend'
const {
  data: hot, loading: hotLoading, pending: hotPending, refreshing: hotRefreshing,
  error: hotError, refreshError: hotRefreshError, load: loadHot
} = useRecommendationFeed<HotRecommendVO>(
  { items: [], currentTopic: null },
  async signal => {
    const result = await getHotRecommend(12, signal)
    return { items: result.items || [], currentTopic: result.currentTopic || null }
  },
  '暂时无法加载热门作品，请稍后重试'
)
const {
  data: featuredItems, loading: featuredLoading, pending: featuredPending, refreshing: featuredRefreshing,
  error: featuredError, refreshError: featuredRefreshError, load: loadFeatured
} = useRecommendationFeed<RecommendItemVO[]>(
  [], async signal => (await getFeaturedRecommend(12, signal)) || [],
  '暂时无法加载精选，请稍后重试'
)
const {
  data: tripItems, loading: tripLoading, pending: tripPending, refreshing: tripRefreshing,
  error: tripError, refreshError: tripRefreshError, load: loadTrips
} = useRecommendationFeed<TripVO[]>(
  [], async signal => (await getTripsRecommend(6, signal)) || [],
  '暂时无法加载旅途，请稍后重试'
)
onMounted(() => {
  void loadHot()
  void loadFeatured()
  void loadTrips()
})
</script>
<template>
  <div class="home-page">
    <FeaturedHero :slides="heroSlides" />
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
      <nav class="home-chapters" aria-label="首页内容">
        <a href="#featured"><span>01</span> 精选影像 <span aria-hidden="true">↓</span></a>
        <a href="#journeys"><span>02</span> 旅途回忆 <span aria-hidden="true">↓</span></a>
        <a href="#popular"><span>03</span> 热门作品 <span aria-hidden="true">↓</span></a>
      </nav>
      <HomeMediaSection
        id="featured"
        class="home-section"
        tabindex="-1"
        title="精选影像"
        eyebrow="01 / SELECTED WORKS"
        subtitle="用心挑选的片刻，每次相遇都有新发现。"
        :items="featuredItems"
        :loading="featuredLoading"
        :pending="featuredPending"
        :refreshing="featuredRefreshing"
        :error="featuredError"
        :refresh-error="featuredRefreshError"
        refresh-label="换一组"
        empty-text="精选影像正在整理，先沿时间线逛逛。"
        @refresh="loadFeatured"
      />
      <router-link to="/timeline" class="section-link"
        >浏览时间线 <span>↗</span></router-link
      >
      <div id="journeys" class="journey-intro home-section" tabindex="-1">
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
        smooth-drag
        subtitle="按拍摄月份与地点整理，沿着影像重访旧地。"
        :loading="tripLoading"
        :error="tripError"
        :has-items="tripItems.length > 0"
        empty-text="暂时没有可聚合的旅途。带有拍摄时间和位置的影像，会在这里串成回忆。"
        @retry="loadTrips"
      >
        <template #actions>
          <button class="home-action" type="button" :disabled="tripPending" aria-label="刷新旅途回忆" @click="loadTrips">
            {{ tripRefreshing ? '更新中…' : '刷新' }} <span aria-hidden="true">↻</span>
          </button>
        </template>
        <template #notice>
          <p v-if="tripRefreshError" class="home-notice" role="status">{{ tripRefreshError }}</p>
        </template>
        <template #empty>
          <router-link to="/map" class="home-empty-link">去地图探索影像 ↗</router-link>
        </template>
        <TripCard v-for="trip in tripItems" :key="trip.tripId" :trip="trip" />
      </RecommendSection>
    </section>
    <section id="popular" class="popular-area home-section" tabindex="-1">
      <HomeMediaSection
        title="热门作品"
        eyebrow="03 / IN FOCUS"
        subtitle="结合点赞、评论与发布时间，发现正在被看见的瞬间。"
        :items="hot.items"
        :loading="hotLoading"
        :pending="hotPending"
        :refreshing="hotRefreshing"
        :error="hotError"
        :refresh-error="hotRefreshError"
        empty-text="还没有热门作品，去时间线发现更多影像。"
        @refresh="loadHot"
      >
        <template #context>
          <router-link v-if="hot.currentTopic && hot.items.length" class="topic-link"
            :to="{ name: 'Search', query: { q: hot.currentTopic.tagName } }">
            搜索热门主题 · {{ hot.currentTopic.tagName }} <span aria-hidden="true">↗</span>
          </router-link>
        </template>
      </HomeMediaSection>
    </section>
  </div>
</template>
<style scoped>
.home-section { scroll-margin-top: 24px; }
.home-chapters { display: flex; flex-wrap: wrap; gap: 8px 24px; padding: 4px 0 24px; }
.home-chapters a { display: flex; align-items: center; gap: 12px; min-height: 44px; color: var(--muted); font-size: 13px; }
.home-chapters a:hover { color: var(--accent); }
.home-chapters a span { font: 11px var(--mono); color: var(--accent-warm); }
.home-action { min-height: 44px; padding: 8px 14px; border: 1px solid var(--line); background: transparent; color: var(--muted); font-size: 13px; }
.home-action span { margin-left: 8px; }
.home-action:hover:not(:disabled) { color: var(--accent); border-color: var(--accent); }
.home-action:disabled { opacity: .55; }
.home-notice { margin: 0 0 16px; padding: 12px 16px; border-left: 2px solid var(--accent-warm); background: var(--accent-warm-soft); color: var(--text); font-size: 13px; }
.home-empty-link, .topic-link { display: inline-flex; align-items: center; gap: 12px; min-height: 44px; font-size: 13px; color: var(--accent); }
.topic-link { margin: 0 0 12px; max-width: 100%; overflow-wrap: anywhere; }
.selected-area {
  background: var(--collection-bg);
  color: var(--text);
  padding: 64px 8% 56px;
  scroll-margin-top: 24px;
  --surface: var(--collection-surface);
  --surface-raised: var(--collection-raised);
  --line: var(--collection-line);
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
  border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
  border-radius: 50%;
  color: var(--accent);
  margin-right: 16px;
  flex-shrink: 0;
}
.chapter-orbit:before {
  content: '';
  position: absolute;
  inset: 9px;
  border: 1px solid color-mix(in srgb, var(--accent-warm) 50%, transparent);
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

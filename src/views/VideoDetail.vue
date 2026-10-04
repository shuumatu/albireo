<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import VideoPlayer from '../components/VideoPlayer.vue'
import CommentSection from '../components/CommentSection.vue'
import SimilarStrip from '../components/SimilarStrip.vue'
import type { VideoPlayback } from '../types/media'
import type { VideoSource } from '../types/video'
import { getVideoInfo } from '../api/video'
import dayjs from 'dayjs'
const route = useRoute(),
  router = useRouter(),
  uuid = String(route.params.uuid)
const playback = ref<VideoPlayback>()
const videoSources = ref<VideoSource[]>([]),
  posterUrl = ref(''),
  loading = ref(true),
  error = ref(false)
const videoData = ref({
  title: '',
  description: '',
  createdAt: '',
  shotAt: '',
  tags: [] as string[]
})
function back() {
  if (window.history.state?.back) router.back()
  else router.push('/timeline')
}
async function load() {
  loading.value = true
  error.value = false
  try {
    const v = await getVideoInfo(uuid)
    videoData.value = {
      title: v.title || '未命名视频',
      description: v.description || '',
      createdAt: dayjs(v.createdAt).format('YYYY-MM-DD HH:mm'),
      shotAt: v.shotAt ? dayjs(v.shotAt).format('YYYY-MM-DD HH:mm') : '',
      tags: (v.tags || []).map((t) => t.name)
    }
    const sources: VideoSource[] = []
    if (v.sourceUrl)
      sources.push({ src: v.sourceUrl, label: '原画', type: 'video/mp4' })
    for (const version of v.videoVersions || []) {
      if (version.status === 'done' && version.url)
        sources.push({
          src: version.url,
          label: version.resolution.toUpperCase(),
          type: 'video/mp4'
        })
    }
    playback.value = v.playback
    videoSources.value = sources
    posterUrl.value = v.posterUrl || v.coverUrl || ''
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
}
onMounted(load)
</script>
<template>
  <article class="video-detail">
    <nav class="video-nav">
      <button class="archive-action" @click="back">← 返回</button
      ><span class="archive-eyebrow">ALBIREO / MOTION PICTURE</span>
    </nav>
    <div v-if="loading" class="archive-state" role="status">正在加载视频…</div>
    <div v-else-if="error" class="archive-state" role="alert">
      <h1>暂时无法打开这段视频</h1>
      <p>请检查连接，或稍后再试。</p>
      <button class="archive-action" @click="load">重新加载</button>
    </div>
    <template v-else
      ><div class="video-grid">
        <div class="video-stage">
          <VideoPlayer
            v-if="playback || videoSources.length"
            :playback="playback"
            :video-sources="videoSources"
            :poster="posterUrl"
          />
          <div v-else class="archive-state">
            <h2>视频尚未准备好</h2>
            <p>可稍后刷新查看，或浏览其他作品。</p>
            <button class="archive-action" @click="load">重新加载</button>
          </div>
        </div>
        <aside class="video-meta hud-panel">
          <span class="archive-eyebrow">VIDEO ARCHIVE</span>
          <h1>{{ videoData.title }}</h1>
          <p v-if="videoData.description">{{ videoData.description }}</p>
          <dl>
            <template v-if="videoData.shotAt"
              ><dt>拍摄时间</dt>
              <dd>{{ videoData.shotAt }}</dd></template
            >
            <dt>收录时间</dt>
            <dd>{{ videoData.createdAt }}</dd>
          </dl>
          <div class="video-tags">
            <span v-for="tag in videoData.tags" :key="tag">{{ tag }}</span>
          </div>
          <span class="meta-note">MOTION. PLACE. MEMORY.</span>
        </aside>
      </div>
      <SimilarStrip type="video" :uuid="uuid" />
      <section class="video-comments hud-panel">
        <CommentSection target-type="video" :target-id="uuid" /></section
    ></template>
  </article>
</template>
<style scoped>
.video-detail {
  padding: 28px 5% 64px;
  max-width: 1640px;
  margin: auto;
}
.video-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  gap: 16px;
}
.video-nav .archive-eyebrow {
  margin: 0;
  font-size: 10px;
}
.video-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  border: 1px solid var(--line);
  margin-bottom: 28px;
}
.video-stage {
  min-width: 0;
  background: color-mix(in srgb, var(--bg) 60%, black);
  display: flex;
  align-items: center;
  justify-content: center;
}
.video-stage > * {
  width: 100%;
  min-width: 0;
}
.video-meta {
  padding: 40px 28px;
  border: 0;
  border-left: 1px solid var(--line);
  display: flex;
  flex-direction: column;
}
.video-meta h1 {
  font-size: 28px;
  line-height: 1.4;
  overflow-wrap: anywhere;
  margin: 16px 0 20px;
}
.video-meta .archive-eyebrow {
  color: var(--star-gold);
}
.video-meta p {
  font-size: 14px;
  line-height: 1.9;
  color: var(--muted);
  white-space: pre-wrap;
}
.video-meta dl {
  font-size: 12px;
  border-top: 1px solid var(--line);
  padding: 24px 0;
  display: grid;
  grid-template-columns: 72px 1fr;
  gap: 18px 10px;
}
.video-meta dt {
  color: var(--muted);
}
.video-meta dd {
  margin: 0;
  text-align: right;
}
.video-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.video-tags span {
  padding: 5px 9px;
  border: 1px solid var(--line);
  color: var(--accent);
  background: var(--star-blue-soft);
  font-size: 12px;
}
.meta-note {
  font: 10px var(--mono);
  letter-spacing: 1px;
  color: var(--star-blue);
  margin-top: auto;
  padding-top: 32px;
}
.video-comments {
  padding: 30px;
}
@media (max-width: 1000px) {
  .video-grid {
    grid-template-columns: 1fr;
  }
  .video-meta {
    border-left: 0;
    border-top: 1px solid var(--line);
  }
}
@media (max-width: 600px) {
  .video-detail {
    padding: 20px;
  }
  .video-meta {
    padding: 28px 20px;
  }
  .video-meta h1 {
    font-size: 24px;
  }
  .video-comments {
    padding: 20px;
  }
  .video-nav .archive-eyebrow {
    font-size: 8px;
    letter-spacing: 0;
  }
}
</style>

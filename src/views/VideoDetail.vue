<template>
  <div class="vd-page">
    <!-- Video Player -->
    <div class="vd-player-wrap">
      <VideoPlayer
        v-if="videoSources.length > 0"
        :video-sources="videoSources"
        :poster="posterUrl"
        @playing="videoPlaying = true"
        @pause="videoPlaying = false"
      />
      <div v-else class="vd-loading">
        <n-spin size="large" />
      </div>
    </div>

    <!-- Metadata -->
    <div class="vd-meta">
      <div class="vd-time-row">
        <span v-if="videoData.shotAt" class="vd-time-item">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          拍摄于 {{ videoData.shotAt }}
        </span>
        <span class="vd-time-item">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          上传于 {{ videoData.createdAt }}
        </span>
      </div>

      <div class="vd-tags-row">
        <span v-for="tag in videoData.tags" :key="tag" class="vd-tag">{{ tag }}</span>
      </div>

      <p class="vd-desc">{{ videoData.description }}</p>
    </div>

    <!-- 视觉相似推荐：基于本视频封面 embedding 的 ANN -->
    <div class="vd-similar">
      <SimilarStrip type="video" :uuid="uuid as string" />
    </div>

    <!-- Comments Section -->
    <div class="vd-comments">
      <CommentSection target-type="video" :target-id="uuid as string" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { NSpin } from 'naive-ui'
import VideoPlayer from '../components/VideoPlayer.vue'
import CommentSection from '../components/CommentSection.vue'
import SimilarStrip from '../components/SimilarStrip.vue'
import type { VideoSource } from '../types/video'
import { useRoute } from 'vue-router'
import { getVideoInfo } from '../api/video'
import { getSystemConfig } from '../api/systemConfig'
import dayjs from 'dayjs'

const route = useRoute()
const videoSources = ref<VideoSource[]>([])
const posterUrl = ref<string>('')
const videoPlaying = ref(false)

const uuid = Array.isArray(route.params.uuid) ? route.params.uuid[0] : route.params.uuid

const videoData = ref({
  title: '加载中...',
  description: '正在获取视频信息...',
  createdAt: '',
  shotAt: '',
  tags: [] as string[],
})

async function fetchVideoInfo() {
  try {
    const [videoResponse, customDomainConfig] = await Promise.all([
      getVideoInfo(uuid as string),
      getSystemConfig('storage', 'custom_domain').catch(() => null)
    ])

    videoData.value.title = videoResponse.title
    videoData.value.description = videoResponse.description
    videoData.value.createdAt = dayjs(videoResponse.createdAt).format('YYYY-MM-DD HH:mm')
    if (videoResponse.shotAt) {
      videoData.value.shotAt = dayjs(videoResponse.shotAt).format('YYYY-MM-DD HH:mm')
    }
    videoData.value.tags = videoResponse.tags.map(tag => tag.name)

    const objectKey = videoResponse.objectKey || (videoResponse as any).url || ''
    const customDomain = customDomainConfig?.value || 'albireo.shuumatu.com'
    const domain = customDomain.startsWith('http') ? customDomain : `https://${customDomain}`
    const normalizedObjectKey = objectKey.startsWith('/') ? objectKey.slice(1) : objectKey
    const originalUrl = `${domain}/${normalizedObjectKey}`
    const basePath = originalUrl.replace(/\/original\/[^/]*$/, '')

    // 原画始终存在（上传完就有，不依赖转码）；转码档按后端 video_versions 实际登记
    // 的 'done' 行筛选——避免播放器列出 R2 上根本不存在的清晰度而 404。
    const sources: VideoSource[] = [
      { src: originalUrl, label: '原画', type: 'video/mp4' },
    ]
    const QUALITY_DISPLAY: Array<{ resolution: string; label: string }> = [
      { resolution: '1080p', label: '1080P' },
      { resolution: '720p', label: '720P' },
      { resolution: '480p', label: '480P' },
    ]
    const doneResolutions = new Set(
      (videoResponse.videoVersions ?? [])
        .filter(v => v.status === 'done')
        .map(v => v.resolution)
    )
    for (const q of QUALITY_DISPLAY) {
      if (doneResolutions.has(q.resolution)) {
        sources.push({
          src: `${basePath}/${q.resolution}/${q.resolution}.mp4`,
          label: q.label,
          type: 'video/mp4',
        })
      }
    }
    videoSources.value = sources

    if (videoResponse.coverUrl) {
      const coverUrl = videoResponse.coverUrl.startsWith('http')
        ? videoResponse.coverUrl
        : `${domain}/${videoResponse.coverUrl.startsWith('/') ? videoResponse.coverUrl.slice(1) : videoResponse.coverUrl}`
      posterUrl.value = coverUrl
    } else if ((videoResponse as any).thumbnailUrl) {
      const thumbnailUrl = (videoResponse as any).thumbnailUrl
      posterUrl.value = thumbnailUrl.startsWith('http')
        ? thumbnailUrl
        : `${domain}/${thumbnailUrl.startsWith('/') ? thumbnailUrl.slice(1) : thumbnailUrl}`
    }
  } catch (error) {
    console.error('获取视频信息失败:', error)
  }
}

onMounted(() => { fetchVideoInfo() })
</script>

<style scoped>
/* 全屏背景包裹层 */
.vd-page {
  min-height: 100vh;
  background: #E8F5EE;
  padding: 32px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  box-sizing: border-box;
}

/* 内容区居中限宽 */
.vd-player-wrap,
.vd-meta,
.vd-similar,
.vd-comments {
  width: calc(100% - 48px);
  max-width: 900px;
  box-sizing: border-box;
}

.vd-player-wrap { margin-bottom: 20px; }
.vd-meta { margin-bottom: 16px; }
.vd-similar { margin-bottom: 16px; }

/* Player */
.vd-player-wrap :deep(.vd-player-inner),
.vd-player-wrap > * {
  border-radius: 12px;
  overflow: hidden;
}

.vd-loading {
  aspect-ratio: 16 / 9;
  background: #1A1A2E;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Metadata */
.vd-meta {
  background: #FFFFFF;
  border-radius: 12px;
  padding: 20px 24px;
  border: 1px solid #B8D9C4;
  box-shadow: 0 2px 8px rgba(76, 175, 125, 0.08);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.vd-time-row {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
}

.vd-time-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #5F7A6A;
}

.vd-time-item svg {
  color: #8FA89A;
  flex-shrink: 0;
}

.vd-tags-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.vd-tag {
  background: #E0F2E7;
  color: #2E7D52;
  font-size: 12px;
  font-weight: 500;
  padding: 4px 12px;
  border-radius: 12px;
}

.vd-desc {
  font-size: 14px;
  color: #5F7A6A;
  line-height: 1.5;
  margin: 0;
}

/* 视觉相似 */
.vd-similar {
  background: #FFFFFF;
  border-radius: 12px;
  padding: 4px 4px 8px;
  border: 1px solid #B8D9C4;
  box-shadow: 0 2px 8px rgba(76, 175, 125, 0.08);
  overflow: hidden;
}

/* 视频页是浅色主题，覆盖 RecommendSection 默认的深色文字 */
.vd-similar :deep(.section-title) { color: #2E7D52; }
.vd-similar :deep(.section-subtitle) { color: #5F7A6A; }
.vd-similar :deep(.scroll-btn) {
  border-color: #B8D9C4;
  background-color: #E8F5EE;
  color: #2E7D52;
}
.vd-similar :deep(.scroll-btn:hover:not(:disabled)) {
  background-color: #D7ECDF;
}

/* Comments */
.vd-comments {
  background: #FFFFFF;
  border-radius: 12px;
  padding: 20px 24px;
  border: 1px solid #B8D9C4;
  box-shadow: 0 2px 8px rgba(76, 175, 125, 0.08);
}

@media (max-width: 768px) {
  .vd-page {
    padding: 16px 12px;
  }
}
</style>

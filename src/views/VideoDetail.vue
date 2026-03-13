<template>
  <div class="video-detail-page" :class="{ 'video-playing': videoPlaying }">
    <!-- 星空背景层 -->
    <div class="starfield">
      <div class="stars-layer stars-layer-1"></div>
      <div class="stars-layer stars-layer-2"></div>
      <div class="stars-layer stars-layer-3"></div>
    </div>

    <!-- 天文几何背景 -->
    <div class="astronomical-background">
      <!-- Albireo黄蓝双星系统 -->
      <div class="albireo-system">
        <div class="albireo-orbit">
          <!-- 金黄色主星 (Albireo A) -->
          <div class="albireo-star-a">
            <div class="star-glow-a"></div>
          </div>
          <!-- 蓝色伴星 (Albireo B) -->
          <div class="albireo-star-b">
            <div class="star-glow-b"></div>
          </div>
        </div>
      </div>

      <!-- 行星轨道 -->
      <div class="orbit orbit-1">
        <div class="planet planet-1"></div>
      </div>
      <div class="orbit orbit-2">
        <div class="planet planet-2"></div>
      </div>
      <div class="orbit orbit-3">
        <div class="planet planet-3"></div>
      </div>
      
      <!-- 左侧流星群 -->
      <div class="shooting-star shooting-star-left-1"></div>
      <div class="shooting-star shooting-star-left-2"></div>
      <div class="shooting-star shooting-star-left-3"></div>
      <div class="shooting-star shooting-star-left-4"></div>
      <div class="shooting-star shooting-star-left-5"></div>
      
      <!-- 右侧流星群 -->
      <div class="shooting-star shooting-star-right-1"></div>
      <div class="shooting-star shooting-star-right-2"></div>
      <div class="shooting-star shooting-star-right-3"></div>
      <div class="shooting-star shooting-star-right-4"></div>
      <div class="shooting-star shooting-star-right-5"></div>
      
      <!-- 星座连线 -->
      <svg class="constellation" viewBox="0 0 200 200">
        <g class="constellation-lines">
          <line x1="30" y1="40" x2="60" y2="25" />
          <line x1="60" y1="25" x2="90" y2="35" />
          <line x1="90" y1="35" x2="80" y2="65" />
          <line x1="80" y1="65" x2="50" y2="70" />
          <line x1="50" y1="70" x2="30" y2="40" />
          <circle cx="30" cy="40" r="2" class="star-point" />
          <circle cx="60" cy="25" r="2" class="star-point" />
          <circle cx="90" cy="35" r="2" class="star-point" />
          <circle cx="80" cy="65" r="2" class="star-point" />
          <circle cx="50" cy="70" r="2" class="star-point" />
        </g>
      </svg>
      
      <!-- 月亮 -->
      <div class="moon">
        <div class="moon-crater crater-1"></div>
        <div class="moon-crater crater-2"></div>
        <div class="moon-crater crater-3"></div>
      </div>
    </div>

    <!-- 主要内容 -->
    <n-config-provider :theme-overrides="themeOverrides">
      <motion.div
        :initial="{ opacity: 0, y: 30 }"
        :animate="{ opacity: 1, y: 0 }"
        :transition="{ duration: 0.8, ease: 'easeOut' }"
        class="content-wrapper"
      >
        <n-space vertical :size="24">
          <!-- 视频播放器区域 -->
          <motion.div
            :initial="{ opacity: 0, scale: 0.95 }"
            :animate="{ opacity: 1, scale: 1 }"
            :transition="{ duration: 0.6, delay: 0.2 }"
          >
            <n-card 
              :bordered="false" 
              class="video-card cosmic-card"
              :segmented="{
                content: true,
                footer: 'soft'
              }"
            >
              <!-- 这里放置你的视频播放器组件 -->
              <div class="video-player-placeholder">
                <!-- <div class="cosmic-play-button">
                  <n-icon :size="80" color="#FFD93D">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M8 5v14l11-7z"/>
                    </svg>
                  </n-icon>
                </div>
                <p style="margin-top: 16px; color: #999;">视频播放器组件位置</p> -->
                <!-- 只在数据加载完成后才渲染播放器 -->
                <VideoPlayer 
                  v-if="videoSources.length > 0"
                  :video-sources="videoSources" 
                  :poster="posterUrl"
                  @playing="videoPlaying = true"
                  @pause="videoPlaying = false"
                />
                
                <!-- 加载中状态 -->
                <div v-else class="loading-state">
                  <n-spin size="large" />
                  <p style="margin-top: 16px; color: #999;">加载中...</p>
                </div>
              </div>
            </n-card>
          </motion.div>

          <!-- 视频信息区域 -->
          <motion.div
            :initial="{ opacity: 0, y: 20 }"
            :animate="{ opacity: 1, y: 0 }"
            :transition="{ duration: 0.6, delay: 0.4 }"
          >
            <n-card 
              :bordered="false"
              class="info-card cosmic-card"
            >
              <n-space vertical :size="20">
                <!-- 标题与星星装饰 -->
                <motion.div
                  :initial="{ opacity: 0, x: -20 }"
                  :animate="{ opacity: 1, x: 0 }"
                  :transition="{ duration: 0.5, delay: 0.6 }"
                  class="title-section"
                >
                  <div class="title-decoration">
                    <span class="star-icon">✦</span>
                    <span class="star-icon">✧</span>
                  </div>
                  <n-h2 class="video-title">
                    {{ videoData.title }}
                  </n-h2>
                </motion.div>

                <!-- 发布日期和标签 -->
                <motion.div
                  :initial="{ opacity: 0 }"
                  :animate="{ opacity: 1 }"
                  :transition="{ duration: 0.5, delay: 0.7 }"
                >
                  <n-space :size="12" align="center">
                    <n-tag 
                      v-if="videoData.shotAt"
                      :bordered="false" 
                      type="warning"
                      size="medium"
                      class="date-tag cosmic-tag"
                    >
                      <template #icon>
                        <n-icon>
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                            <path fill="currentColor" d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                          </svg>
                        </n-icon>
                      </template>
                      拍摄于 {{ videoData.shotAt }}
                    </n-tag>

                    <n-tag 
                      :bordered="false" 
                      type="warning"
                      size="medium"
                      class="date-tag cosmic-tag"
                    >
                      <template #icon>
                        <n-icon>
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                            <path fill="currentColor" d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm4.2 14.2L11 13V7h1.5v5.2l4.5 2.7-.8 1.3z"/>
                          </svg>
                        </n-icon>
                      </template>
                      上传于 {{ videoData.createdAt }}
                    </n-tag>

                    <n-space :size="8">
                      <motion.div
                        v-for="(tag, index) in videoData.tags"
                        :key="tag"
                        :initial="{ opacity: 0, scale: 0.8 }"
                        :animate="{ opacity: 1, scale: 1 }"
                        :transition="{ duration: 0.4, delay: 0.8 + index * 0.1 }"
                      >
                        <n-tag 
                          :bordered="false"
                          type="info"
                          size="medium"
                          class="video-tag cosmic-tag"
                        >
                          <span class="tag-star">★</span>
                          {{ tag }}
                        </n-tag>
                      </motion.div>
                    </n-space>
                  </n-space>
                </motion.div>

                <!-- 简介 -->
                <motion.div
                  :initial="{ opacity: 0, y: 10 }"
                  :animate="{ opacity: 1, y: 0 }"
                  :transition="{ duration: 0.6, delay: 0.9 }"
                >
                  <n-divider class="cosmic-divider">
                    <span class="divider-text">
                      <span class="orbit-icon">🌙</span>
                      视频简介
                    </span>
                  </n-divider>
                  <n-p class="video-description">
                    {{ videoData.description }}
                  </n-p>
                </motion.div>

                <!-- 统计信息 -->
                <motion.div
                  :initial="{ opacity: 0, y: 10 }"
                  :animate="{ opacity: 1, y: 0 }"
                  :transition="{ duration: 0.6, delay: 1.0 }"
                  class="stats-section"
                >
                  <n-space :size="32">
                    <!-- <div class="stat-item">
                      <div class="stat-icon-wrapper view-stat">
                        <n-icon :size="24">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                            <path fill="currentColor" d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                          </svg>
                        </n-icon>
                      </div>
                      <div class="stat-content">
                        <div class="stat-label">观看次数</div>
                        <div class="stat-value">{{ videoData.views.toLocaleString() }}</div>
                      </div>
                    </div> -->
                    
                    <!-- <div class="stat-item">
                      <div class="stat-icon-wrapper like-stat">
                        <n-icon :size="24">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                            <path fill="currentColor" d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/>
                          </svg>
                        </n-icon>
                      </div>
                      <div class="stat-content">
                        <div class="stat-label">点赞数</div>
                        <div class="stat-value">{{ videoData.likes.toLocaleString() }}</div>
                      </div>
                    </div> -->
                  </n-space>
                </motion.div>
              </n-space>
            </n-card>
          </motion.div>
        </n-space>
      </motion.div>
    </n-config-provider>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { motion } from 'motion-v'
import {
  NConfigProvider,
  NCard,
  NSpace,
  NH2,
  NH3,
  NP,
  NTag,
  NIcon,
  NDivider
} from 'naive-ui'
import VideoPlayer from '../components/VideoPlayer.vue'
import type { VideoSource } from '../types/video'
import { useRoute } from 'vue-router'
import { getVideoInfo } from '../api/video'
import { getSystemConfig } from '../api/systemConfig'
import dayjs from 'dayjs'  // 导入 dayjs
import { NSpin } from 'naive-ui'

const route = useRoute()

const videoSources = ref<VideoSource[]>([])

const posterUrl = ref<string>('')

// 播放中状态：用于暂停页面背景动画，减轻主线程压力、缓解卡顿
const videoPlaying = ref(false)

// 从路由参数中获取 uuid
const uuid = Array.isArray(route.params.uuid) 
  ? route.params.uuid[0] 
  : route.params.uuid;



// 视频数据
const videoData = ref({
  title: '加载中...',
  description: '正在获取视频信息...',
  createdAt: '',
  shotAt: '',
  tags: [] as string[],
  views: 0
})
async function fetchVideoInfo() {
  try {
    // 并行获取视频信息和自定义域名配置
    const [videoResponse, customDomainConfig] = await Promise.all([
      getVideoInfo(uuid as string),
      getSystemConfig('storage', 'custom_domain').catch(() => null) // 如果获取失败，返回 null
    ])
    
    // 更新视频信息
    videoData.value.title = videoResponse.title
    videoData.value.description = videoResponse.description
    // 使用 dayjs 格式化日期
    videoData.value.createdAt = dayjs(videoResponse.createdAt).format('YYYY-MM-DD HH:mm')
    if (videoResponse.shotAt) {
      videoData.value.shotAt = dayjs(videoResponse.shotAt).format('YYYY-MM-DD HH:mm')
    }
    videoData.value.tags = videoResponse.tags.map(tag => tag.name) // 将对象数组转换为字符串数组
    
    // 获取 objectKey（优先使用 objectKey，如果没有则使用 url）
    const objectKey = videoResponse.objectKey || (videoResponse as any).url || ''
    
    // 获取自定义域名，如果没有配置则使用默认值
    const customDomain = customDomainConfig?.value || 'albireo.shuumatu.com'
    
    // 确保域名包含协议
    const domain = customDomain.startsWith('http') ? customDomain : `https://${customDomain}`
    
    // 构建完整 URL：域名 + objectKey
    // objectKey 格式如：videos/f06e9f133f7d404fbd711584993b1b4d1d24af90df04211d55362ff04fb0b493/original/C0068.mp4
    // 确保 objectKey 不以 / 开头，避免双斜杠
    const normalizedObjectKey = objectKey.startsWith('/') ? objectKey.slice(1) : objectKey
    const originalUrl = `${domain}/${normalizedObjectKey}`
    
    // 提取基础路径（去掉 /original/文件名 部分）
    const basePath = originalUrl.replace(/\/original\/[^/]*$/, '')
    
    videoSources.value = [
      {
        src: originalUrl,  // 原画直接使用
        label: '原画',
        type: 'video/mp4'
      },
      {
        src: `${basePath}/1080p/1080p.mp4`,
        label: '1080P',
        type: 'video/mp4'
      },
      {
        src: `${basePath}/720p/720p.mp4`,
        label: '720P',
        type: 'video/mp4'
      },
      {
        src: `${basePath}/480p/480p.mp4`,
        label: '480P',
        type: 'video/mp4'
      }
    ]
    
    console.log('Object Key:', objectKey)
    console.log('自定义域名:', customDomain)
    console.log('完整域名:', domain)
    console.log('原始 URL:', originalUrl)
    console.log('基础路径:', basePath)
    console.log('所有视频源:', videoSources.value)
    
    // 更新封面图（如果 thumbnailUrl 也需要拼接域名）
    if (videoResponse.coverUrl) {
      // 如果 coverUrl 是完整的 URL，直接使用；如果是 objectKey，则拼接域名
      const coverUrl = videoResponse.coverUrl.startsWith('http') 
        ? videoResponse.coverUrl 
        : `${domain}/${videoResponse.coverUrl.startsWith('/') ? videoResponse.coverUrl.slice(1) : videoResponse.coverUrl}`
      posterUrl.value = coverUrl
    } else if ((videoResponse as any).thumbnailUrl) {
      const thumbnailUrl = (videoResponse as any).thumbnailUrl
      const normalizedThumbnailUrl = thumbnailUrl.startsWith('http') 
        ? thumbnailUrl 
        : `${domain}/${thumbnailUrl.startsWith('/') ? thumbnailUrl.slice(1) : thumbnailUrl}`
      posterUrl.value = normalizedThumbnailUrl
    }
  } catch (error) {
    console.error('获取视频信息失败:', error)
    // 可以在这里添加错误提示
  }
}

onMounted(() => { 
  fetchVideoInfo()
})

// 示例视频数据
// let videoData = ref({
//   title: '探索宇宙奥秘：从星云到黑洞的奇妙旅程',
//   description: '在浩瀚的宇宙中,隐藏着无数令人惊叹的天文现象。本视频将带你穿越星际空间,探索从绚丽的星云、神秘的暗物质,到令人敬畏的黑洞等宇宙奇观。我们将深入解析这些天体的形成机制、物理特性,以及它们对宇宙演化的重要意义。通过前沿的观测数据和精美的可视化效果,让我们一起揭开宇宙最深层的秘密,感受天文学的无穷魅力。',
//   createdAt: '2024-03-15',
//   tags: ['天文学', '宇宙探索', '科普教育', '星空观测']
//   // views: 125800,
//   // likes: 8560
// })




//===================================================
// 主题配置 - 天文星空配色
const themeOverrides = {
  common: {
    primaryColor: '#5B8FD9',
    primaryColorHover: '#7AA9E8',
    primaryColorPressed: '#4A7AB8',
    infoColor: '#5B8FD9',
    infoColorHover: '#7AA9E8',
    warningColor: '#FFD93D',
    warningColorHover: '#FFE57A',
    borderRadius: '20px',
    bodyColor: 'rgba(15, 23, 42, 0.6)'
  },
  Card: {
    borderRadius: '24px',
    paddingMedium: '32px',
    color: 'rgba(255, 255, 255, 0.08)',
    boxShadow: '0 8px 32px rgba(91, 143, 217, 0.15), 0 0 60px rgba(255, 217, 61, 0.08)',
  },
  Tag: {
    borderRadius: '14px',
    padding: '0 18px',
    heightMedium: '34px'
  }
}




</script>

<style scoped>
.video-detail-page {
  min-height: 100vh;
  background: linear-gradient(180deg, #0F172A 0%, #1E293B 50%, #334155 100%);
  padding: 40px 20px;
  position: relative;
  overflow: hidden;
}

/* 播放时暂停背景动画，减轻主线程与解码争抢，缓解卡顿 */
.video-detail-page.video-playing .starfield,
.video-detail-page.video-playing .starfield *,
.video-detail-page.video-playing .astronomical-background,
.video-detail-page.video-playing .astronomical-background *,
.video-detail-page.video-playing .video-player-placeholder::before {
  animation-play-state: paused !important;
}

.video-detail-page.video-playing .video-card.cosmic-card {
  backdrop-filter: none;
}

/* 星空背景 */
.starfield {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0;
}

.stars-layer {
  position: absolute;
  width: 100%;
  height: 100%;
  background-image: 
    radial-gradient(2px 2px at 20% 30%, white, transparent),
    radial-gradient(2px 2px at 60% 70%, white, transparent),
    radial-gradient(1px 1px at 50% 50%, white, transparent),
    radial-gradient(1px 1px at 80% 10%, white, transparent),
    radial-gradient(2px 2px at 90% 60%, white, transparent),
    radial-gradient(1px 1px at 33% 80%, white, transparent),
    radial-gradient(1px 1px at 15% 55%, white, transparent);
  background-size: 200% 200%;
  background-position: 0% 0%;
}

.stars-layer-1 {
  opacity: 0.3;
  animation: twinkle 8s ease-in-out infinite;
}

.stars-layer-2 {
  opacity: 0.5;
  animation: twinkle 10s ease-in-out infinite 2s;
  background-size: 250% 250%;
}

.stars-layer-3 {
  opacity: 0.2;
  animation: twinkle 12s ease-in-out infinite 4s;
  background-size: 300% 300%;
}

@keyframes twinkle {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.8; }
}

/* 天文几何背景 */
.astronomical-background {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0;
}

/* ===== Albireo 黄蓝双星系统 ===== */
.albireo-system {
  position: absolute;
  top: 20%;
  left: 15%;
  transform: translateX(-50%);
  width: 180px;
  height: 180px;
  animation: float-albireo 20s ease-in-out infinite;
}

@keyframes float-albireo {
  0%, 100% {
    transform: translateX(-50%) translateY(0);
  }
  50% {
    transform: translateX(-50%) translateY(-30px);
  }
}

.albireo-orbit {
  position: relative;
  width: 100%;
  height: 100%;
  animation: rotate-slow 100s linear infinite;
}

@keyframes rotate-slow {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 金黄色主星 Albireo A */
.albireo-star-a {
  position: absolute;
  width: 45px;
  height: 45px;
  top: 50%;
  left: 20%;
  margin-top: -22.5px;
  margin-left: -22.5px;
  background: radial-gradient(circle, #FFEB3B 0%, #FFD93D 40%, #FFAB00 100%);
  border-radius: 50%;
  box-shadow: 
    0 0 20px rgba(255, 217, 61, 0.8),
    0 0 40px rgba(255, 217, 61, 0.6),
    0 0 60px rgba(255, 217, 61, 0.4),
    inset 0 0 15px rgba(255, 235, 59, 0.5);
  animation: pulse-star-a 4s ease-in-out infinite;
}

.star-glow-a {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 235, 59, 0.6) 0%, transparent 70%);
  animation: glow-pulse-a 3s ease-in-out infinite;
}

@keyframes pulse-star-a {
  0%, 100% {
    transform: scale(1);
    box-shadow: 
      0 0 20px rgba(255, 217, 61, 0.8),
      0 0 40px rgba(255, 217, 61, 0.6),
      0 0 60px rgba(255, 217, 61, 0.4);
  }
  50% {
    transform: scale(1.05);
    box-shadow: 
      0 0 30px rgba(255, 217, 61, 1),
      0 0 60px rgba(255, 217, 61, 0.8),
      0 0 90px rgba(255, 217, 61, 0.6);
  }
}

@keyframes glow-pulse-a {
  0%, 100% {
    transform: scale(1.5);
    opacity: 0.4;
  }
  50% {
    transform: scale(2);
    opacity: 0.7;
  }
}

/* 蓝色伴星 Albireo B */
.albireo-star-b {
  position: absolute;
  width: 30px;
  height: 30px;
  top: 50%;
  right: 20%;
  margin-top: -15px;
  margin-right: -15px;
  background: radial-gradient(circle, #82B1FF 0%, #5B8FD9 40%, #2962FF 100%);
  border-radius: 50%;
  box-shadow: 
    0 0 15px rgba(91, 143, 217, 0.9),
    0 0 30px rgba(91, 143, 217, 0.7),
    0 0 45px rgba(91, 143, 217, 0.5),
    inset 0 0 12px rgba(130, 177, 255, 0.6);
  animation: pulse-star-b 3.5s ease-in-out infinite 0.5s;
}

.star-glow-b {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(130, 177, 255, 0.7) 0%, transparent 70%);
  animation: glow-pulse-b 2.8s ease-in-out infinite;
}

@keyframes pulse-star-b {
  0%, 100% {
    transform: scale(1);
    box-shadow: 
      0 0 15px rgba(91, 143, 217, 0.9),
      0 0 30px rgba(91, 143, 217, 0.7),
      0 0 45px rgba(91, 143, 217, 0.5);
  }
  50% {
    transform: scale(1.08);
    box-shadow: 
      0 0 25px rgba(91, 143, 217, 1),
      0 0 50px rgba(91, 143, 217, 0.9),
      0 0 75px rgba(91, 143, 217, 0.7);
  }
}

@keyframes glow-pulse-b {
  0%, 100% {
    transform: scale(1.3);
    opacity: 0.5;
  }
  50% {
    transform: scale(1.8);
    opacity: 0.8;
  }
}

/* 行星轨道 */
.orbit {
  position: absolute;
  border: 1px solid rgba(91, 143, 217, 0.15);
  border-radius: 50%;
  animation: rotate-orbit 60s linear infinite;
}

.orbit-1 {
  width: 300px;
  height: 300px;
  top: 10%;
  right: 5%;
  animation-duration: 40s;
}

.orbit-2 {
  width: 200px;
  height: 200px;
  bottom: 15%;
  left: 5%;
  animation-duration: 50s;
  animation-direction: reverse;
}

.orbit-3 {
  width: 150px;
  height: 150px;
  top: 60%;
  right: 15%;
  animation-duration: 35s;
}

@keyframes rotate-orbit {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 行星 */
.planet {
  position: absolute;
  border-radius: 50%;
  box-shadow: 0 0 20px rgba(255, 217, 61, 0.4);
}

.planet-1 {
  width: 30px;
  height: 30px;
  background: linear-gradient(135deg, #FFD93D, #FFAB00);
  /* 使其位于线上 */
  top: -15px;
  left: 50%;
  margin-left: -15px;
  animation: glow-planet 3s ease-in-out infinite;
}

.planet-2 {
  width: 20px;
  height: 20px;
  background: linear-gradient(135deg, #5B8FD9, #7AA9E8);
  /* 使其位于线上 */
  bottom: -10px;
  right: 50%;
  margin-right: -10px;
  animation: glow-planet 4s ease-in-out infinite 1s;
}

.planet-3 {
  width: 15px;
  height: 15px;
  background: linear-gradient(135deg, #FFF8E1, #FFE57A);
  top: 50%;
  /* 使其位于线上 */
  right: -7.5px;
  margin-top: -7.5px;
  animation: glow-planet 3.5s ease-in-out infinite 2s;
}

@keyframes glow-planet {
  0%, 100% {
    box-shadow: 0 0 15px rgba(255, 217, 61, 0.4);
  }
  50% {
    box-shadow: 0 0 30px rgba(255, 217, 61, 0.8);
  }
}

/* ===== 流星样式 ===== */
.shooting-star {
  position: absolute;
  width: 3px;
  height: 3px;
  background: linear-gradient(to right, white, transparent);
  border-radius: 50%;
  box-shadow: 0 0 6px white;
  opacity: 0;
}

.shooting-star::after {
  content: '';
  position: absolute;
  top: 1px;
  right: 1px;
  width: 80px;
  height: 1px;
  background: linear-gradient(to left, rgba(255, 255, 255, 0.8), transparent);
}

/* 左侧流星群 */
.shooting-star-left-1 {
  top: 15%;
  left: 5%;
  animation: shooting-left 3s ease-in infinite 1s;
}

.shooting-star-left-2 {
  top: 35%;
  left: 8%;
  animation: shooting-left 3.5s ease-in infinite 3s;
}

.shooting-star-left-3 {
  top: 55%;
  left: 3%;
  animation: shooting-left 2.8s ease-in infinite 5.5s;
}

.shooting-star-left-4 {
  top: 25%;
  left: 10%;
  animation: shooting-left 3.2s ease-in infinite 7s;
}

.shooting-star-left-5 {
  top: 70%;
  left: 6%;
  animation: shooting-left 2.5s ease-in infinite 9s;
}

/* 右侧流星群 */
.shooting-star-right-1 {
  top: 20%;
  right: 5%;
  animation: shooting-right 3s ease-in infinite 2s;
}

.shooting-star-right-2 {
  top: 40%;
  right: 8%;
  animation: shooting-right 3.3s ease-in infinite 4s;
}

.shooting-star-right-3 {
  top: 60%;
  right: 4%;
  animation: shooting-right 2.9s ease-in infinite 6.5s;
}

.shooting-star-right-4 {
  top: 30%;
  right: 10%;
  animation: shooting-right 3.4s ease-in infinite 8s;
}

.shooting-star-right-5 {
  top: 75%;
  right: 7%;
  animation: shooting-right 2.6s ease-in infinite 10s;
}


@keyframes shooting-left {
  0% {
    transform: translateX(0) translateY(0) rotate(45deg);
    opacity: 0;
  }
  20%  { opacity: 1; } /* 逐渐显现 */
  80%  { opacity: 1; } /* 保持亮度 */
  100% {
    transform: translateX(250px) translateY(250px) rotate(45deg);
    opacity: 0;
  }
}

@keyframes shooting-right {
  0% {
    transform: translateX(0) translateY(0) rotate(135deg);
    opacity: 0;
  }
  20%  { opacity: 1; } /* 逐渐显现 */
  80%  { opacity: 1; } /* 保持亮度 */
  100% {
    transform: translateX(-250px) translateY(250px) rotate(135deg);
    opacity: 0;
  }
}



/* 星座连线 */
.constellation {
  position: absolute;
  top: 15%;
  left: 10%;
  width: 200px;
  height: 200px;
  opacity: 0.25;
  animation: float-constellation 20s ease-in-out infinite;
}

.constellation-lines line {
  stroke: #5B8FD9;
  stroke-width: 0.5;
  stroke-dasharray: 5, 3;
  animation: dash-line 4s linear infinite;
}

.star-point {
  fill: #FFD93D;
  animation: pulse-star 2s ease-in-out infinite;
}

@keyframes dash-line {
  to {
    stroke-dashoffset: -20;
  }
}

@keyframes pulse-star {
  0%, 100% {
    opacity: 0.6;
    r: 2;
  }
  50% {
    opacity: 1;
    r: 2.5;
  }
}

@keyframes float-constellation {
  0%, 100% {
    transform: translateY(0) translateX(0);
  }
  50% {
    transform: translateY(-20px) translateX(20px);
  }
}

/* 月亮 */
.moon {
  position: absolute;
  width: 80px;
  height: 80px;
  background: linear-gradient(135deg, #FFF8E1 0%, #FFE57A 100%);
  border-radius: 50%;
  bottom: 20%;
  right: 10%;
  box-shadow: 0 0 40px rgba(255, 217, 61, 0.5), inset -10px -10px 20px rgba(0, 0, 0, 0.1);
  animation: moon-glow 8s ease-in-out infinite;
}

.moon-crater {
  position: absolute;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.08);
}

.crater-1 {
  width: 15px;
  height: 15px;
  top: 20%;
  left: 25%;
}

.crater-2 {
  width: 10px;
  height: 10px;
  top: 50%;
  right: 20%;
}

.crater-3 {
  width: 8px;
  height: 8px;
  bottom: 25%;
  left: 45%;
}

@keyframes moon-glow {
  0%, 100% {
    box-shadow: 0 0 40px rgba(255, 217, 61, 0.5), inset -10px -10px 20px rgba(0, 0, 0, 0.1);
  }
  50% {
    box-shadow: 0 0 60px rgba(255, 217, 61, 0.8), inset -10px -10px 20px rgba(0, 0, 0, 0.1);
  }
}

/* 内容容器 */
.content-wrapper {
  max-width: 1200px;
  margin: 0 auto;
  position: relative;
  z-index: 1;
}

/* 宇宙风格卡片 */
.cosmic-card {
  overflow: hidden;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  backdrop-filter: blur(10px);
  background: rgba(30, 41, 59, 0.4) !important;
  border: 1px solid rgba(91, 143, 217, 0.25);
}

.cosmic-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 12px 48px rgba(91, 143, 217, 0.3), 0 0 80px rgba(255, 217, 61, 0.15) !important;
  border-color: rgba(91, 143, 217, 0.5);
  background: rgba(30, 41, 59, 0.5) !important;
}

/* 视频播放器 */
.video-player-placeholder {
  aspect-ratio: 16 / 9;
  background: linear-gradient(135deg, rgba(30, 41, 59, 0.6) 0%, rgba(51, 65, 85, 0.6) 100%);
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: visible;
  backdrop-filter: blur(10px);
}

.video-player-placeholder::before {
  content: '';
  position: absolute;
  width: 200%;
  height: 200%;
  background: radial-gradient(circle, rgba(91, 143, 217, 0.1) 0%, transparent 70%);
  animation: pulse-bg 4s ease-in-out infinite;
}



@keyframes pulse-bg {
  0%, 100% {
    transform: scale(1);
    opacity: 0.3;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.6;
  }
}

.cosmic-play-button {
  position: relative;
  z-index: 1;
  animation: float-button 3s ease-in-out infinite;
}

@keyframes float-button {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

/* 标题区域 */
.title-section {
  position: relative;
}

.title-decoration {
  position: absolute;
  top: -15px;
  right: 0;
  display: flex;
  gap: 8px;
}

.star-icon {
  color: #FFD93D;
  font-size: 20px;
  animation: twinkle-icon 2s ease-in-out infinite;
  display: inline-block;
}

.star-icon:nth-child(2) {
  animation-delay: 1s;
}

@keyframes twinkle-icon {
  0%, 100% {
    opacity: 0.4;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.2);
  }
}

.video-title {
  margin: 0 !important;
  color: #E2E8F0;
  font-size: 32px;
  font-weight: 700;
  line-height: 1.4;
  text-shadow: 0 2px 10px rgba(91, 143, 217, 0.3);
}

/* 标签样式 */
.cosmic-tag {
  font-weight: 600;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.cosmic-tag::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
  transition: left 0.5s;
}

.cosmic-tag:hover::before {
  left: 100%;
}

.date-tag {
  background: linear-gradient(135deg, rgba(255, 217, 61, 0.2), rgba(255, 171, 0, 0.15)) !important;
  color: #FFD93D !important;
  border: 1px solid rgba(255, 217, 61, 0.3);
}

.date-tag:hover {
  transform: translateY(-3px);
  box-shadow: 0 6px 16px rgba(255, 217, 61, 0.35);
  border-color: rgba(255, 217, 61, 0.5);
}

.video-tag {
  background: linear-gradient(135deg, rgba(91, 143, 217, 0.2), rgba(122, 169, 232, 0.15)) !important;
  color: #7AA9E8 !important;
  border: 1px solid rgba(91, 143, 217, 0.3);
}

.video-tag:hover {
  transform: translateY(-3px);
  box-shadow: 0 6px 16px rgba(91, 143, 217, 0.35);
  border-color: rgba(91, 143, 217, 0.5);
}

.tag-star {
  margin-right: 4px;
  color: #FFD93D;
}

/* 分隔线 */
.cosmic-divider {
  border-color: rgba(91, 143, 217, 0.2) !important;
  margin: 24px 0 !important;
}

.divider-text {
  color: #94A3B8;
  font-size: 18px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

.orbit-icon {
  font-size: 20px;
  animation: rotate-icon 10s linear infinite;
  display: inline-block;
}

@keyframes rotate-icon {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 简介 */
.video-description {
  color: #CBD5E1;
  line-height: 1.9;
  font-size: 15px;
  margin: 0 !important;
  text-align: justify;
}

/* 统计信息 */
.stats-section {
  padding-top: 8px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 24px;
  background: linear-gradient(135deg, rgba(91, 143, 217, 0.15), rgba(255, 217, 61, 0.1));
  border-radius: 16px;
  border: 1px solid rgba(91, 143, 217, 0.25);
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
}

.stat-item:hover {
  transform: translateX(8px);
  border-color: rgba(91, 143, 217, 0.35);
  box-shadow: 0 4px 16px rgba(91, 143, 217, 0.15);
}

.stat-icon-wrapper {
  width: 50px;
  height: 50px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.stat-icon-wrapper::before {
  content: '';
  position: absolute;
  width: 100%;
  height: 100%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.2) 0%, transparent 70%);
  animation: pulse-icon 3s ease-in-out infinite;
}

@keyframes pulse-icon {
  0%, 100% {
    transform: scale(0.8);
    opacity: 0.5;
  }
  50% {
    transform: scale(1.2);
    opacity: 1;
  }
}

.view-stat {
  background: linear-gradient(135deg, rgba(91, 143, 217, 0.25), rgba(122, 169, 232, 0.15));
}

.like-stat {
  background: linear-gradient(135deg, rgba(255, 217, 61, 0.25), rgba(255, 171, 0, 0.15));
}

.stat-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-label {
  font-size: 13px;
  color: #94A3B8;
  font-weight: 500;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  background: linear-gradient(135deg, #E2E8F0, #CBD5E1);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .video-detail-page {
    padding: 20px 12px;
  }

  .video-title {
    font-size: 24px;
  }

  .orbit-1, .orbit-2, .orbit-3 {
    width: 150px;
    height: 150px;
  }

  .moon {
    width: 60px;
    height: 60px;
  }

  .constellation {
    width: 150px;
    height: 150px;
  }

  .albireo-system {
    width: 120px;
    height: 120px;
  }

  .albireo-star-a {
    width: 30px;
    height: 30px;
    margin-top: -15px;
    margin-left: -15px;
  }

  .albireo-star-b {
    width: 20px;
    height: 20px;
    margin-top: -10px;
    margin-right: -10px;
  }

  .stat-item {
    padding: 12px 16px;
  }

  .stat-icon-wrapper {
    width: 40px;
    height: 40px;
  }

  .stat-value {
    font-size: 20px;
  }

  .stats-section {
    overflow-x: auto;
  }
}

/* 滚动条样式 */
::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

::-webkit-scrollbar-track {
  background: rgba(30, 41, 59, 0.5);
  border-radius: 5px;
}

::-webkit-scrollbar-thumb {
  background: linear-gradient(135deg, #5B8FD9, #7AA9E8);
  border-radius: 5px;
}

::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(135deg, #4A7AB8, #5B8FD9);
}
</style>
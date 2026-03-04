<template>
  <div class="page">
    <!-- 图片氛围背景：用图片本身的模糊副本作为环境光 -->
    <div v-if="imageLoaded && fullImageUrl" class="ambient-bg">
      <img :src="fullImageUrl" class="ambient-img" alt="" />
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="state-center">
      <motion.div
        :initial="{ opacity: 0 }"
        :animate="{ opacity: 1 }"
        :transition="{ duration: 0.4 }"
        class="state-box"
      >
        <div class="loader"></div>
        <span class="state-text">加载中...</span>
      </motion.div>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="error" class="state-center">
      <motion.div
        :initial="{ opacity: 0, y: 12 }"
        :animate="{ opacity: 1, y: 0 }"
        :transition="{ duration: 0.5 }"
        class="state-box"
      >
        <svg class="state-icon" xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
        </svg>
        <span class="state-title">未找到图片</span>
        <span class="state-text">该图片可能不存在或已被删除</span>
        <button class="btn-ghost" @click="$router.back()">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          返回
        </button>
      </motion.div>
    </div>

    <!-- 主内容 -->
    <template v-else-if="imageData">
      <!-- 顶部导航 -->
      <motion.nav
        :initial="{ opacity: 0 }"
        :animate="{ opacity: 1 }"
        :transition="{ duration: 0.35 }"
        class="nav"
      >
        <button class="btn-ghost" @click="$router.back()">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          返回
        </button>
      </motion.nav>

      <!-- 图片展示 -->
      <motion.div
        :initial="{ opacity: 0, scale: 0.98 }"
        :animate="{ opacity: 1, scale: 1 }"
        :transition="{ duration: 0.55, delay: 0.05 }"
        class="hero"
      >
        <div class="frame" :class="{ loaded: imageLoaded }" @click="openPreview">
          <img
            v-show="imageLoaded"
            ref="imgEl"
            :src="fullImageUrl"
            :alt="imageData.title || imageData.fileName"
            class="hero-img"
            @load="imageLoaded = true"
            @error="imageLoadError = true"
          />
          <div v-if="!imageLoaded && !imageLoadError" class="frame-loading">
            <div class="loader"></div>
          </div>
          <div v-if="imageLoadError" class="frame-loading">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color:#444"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            <span class="frame-error-text">无法加载图片</span>
          </div>

          <!-- hover 交互 -->
          <transition name="fade-fast">
            <div v-if="imageLoaded" class="frame-hover">
              <div class="hover-pill">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
                查看原图
              </div>
            </div>
          </transition>
        </div>
      </motion.div>

      <!-- 信息面板 -->
      <motion.div
        :initial="{ opacity: 0, y: 14 }"
        :animate="{ opacity: 1, y: 0 }"
        :transition="{ duration: 0.5, delay: 0.2 }"
        class="panel"
      >
        <div class="panel-main">
          <!-- 标题 + 状态 -->
          <div class="panel-header">
            <h1 class="title">{{ imageData.title || imageData.fileName }}</h1>
            <span class="status-pill" :class="'sp-' + imageData.status">
              <span class="sp-dot"></span>
              {{ statusText }}
            </span>
          </div>

          <!-- 标签行 -->
          <div class="tags">
            <span v-if="imageData.type" class="tag tag-type">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              {{ imageData.type }}
            </span>
            <span class="tag tag-time">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              {{ formatDate(imageData.createdAt) }}
            </span>
            <span v-if="imageData.fileCreatedAt" class="tag tag-camera">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
              拍摄于 {{ formatDate(imageData.fileCreatedAt!) }}
            </span>
          </div>

          <!-- 描述 -->
          <p v-if="imageData.description" class="desc">{{ imageData.description }}</p>
        </div>

        <!-- 文件详情网格 -->
        <div class="meta-grid">
          <div class="meta-cell">
            <span class="meta-label">文件名</span>
            <span class="meta-value">{{ imageData.fileName }}</span>
          </div>
          <div class="meta-cell">
            <span class="meta-label">状态</span>
            <span class="meta-value" :class="'mv-' + imageData.status">{{ statusText }}</span>
          </div>
          <div v-if="imageData.fileCreatedAt" class="meta-cell">
            <span class="meta-label">拍摄时间</span>
            <span class="meta-value">{{ formatDateTime(imageData.fileCreatedAt!) }}</span>
          </div>
          <div class="meta-cell">
            <span class="meta-label">入库时间</span>
            <span class="meta-value">{{ formatDateTime(imageData.createdAt) }}</span>
          </div>
        </div>
      </motion.div>
    </template>

    <!-- 全屏预览 -->
    <Teleport to="body">
      <Transition name="preview">
        <div v-if="showPreview" class="lightbox" @click="showPreview = false">
          <img
            :src="fullImageUrl"
            :alt="imageData?.title || imageData?.fileName"
            class="lightbox-img"
            @click.stop
          />
          <button class="lightbox-close" @click="showPreview = false" aria-label="关闭">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <div v-if="imageData" class="lightbox-caption">
            {{ imageData.title || imageData.fileName }}
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue'
import { motion } from 'motion-v'
import { useRoute } from 'vue-router'
import { getImageInfo } from '../api/image'
import type { ImageInfoVO } from '../api/image'
import { getSystemConfig } from '../api/systemConfig'
import dayjs from 'dayjs'

const route = useRoute()
const imgEl = ref<HTMLImageElement | null>(null)

const imageData = ref<ImageInfoVO | null>(null)
const loading = ref(true)
const error = ref(false)
const imageLoaded = ref(false)
const imageLoadError = ref(false)
const showPreview = ref(false)
const customDomain = ref('albireo.shuumatu.com')

const uuid = Array.isArray(route.params.uuid)
  ? route.params.uuid[0]
  : route.params.uuid

const statusMap: Record<string, string> = {
  uploading: '上传中',
  processing: '处理中',
  done: '已完成',
  failed: '失败'
}

const statusText = computed(() => {
  if (!imageData.value) return ''
  return statusMap[imageData.value.status] || imageData.value.status
})

const fullImageUrl = computed(() => {
  if (!imageData.value) return ''
  const url = imageData.value.imageUrl
  let full: string
  if (url.startsWith('http')) {
    full = url
  } else {
    const domain = customDomain.value.startsWith('http')
      ? customDomain.value
      : `https://${customDomain.value}`
    const normalized = url.startsWith('/') ? url.slice(1) : url
    full = `${domain}/${normalized}`
  }
  if (/\.heic$/i.test(full)) {
    full = full.replace(/\/raw\/[^/]+\.heic$/i, '/original/original.jpg')
  }
  return full
})

function formatDate(dateStr: string) {
  return dayjs(dateStr).format('YYYY-MM-DD')
}

function formatDateTime(dateStr: string) {
  return dayjs(dateStr).format('YYYY-MM-DD HH:mm')
}

function openPreview() {
  if (imageLoaded.value && !imageLoadError.value) {
    showPreview.value = true
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') showPreview.value = false
}

async function fetchImageInfo() {
  loading.value = true
  error.value = false
  try {
    const [info, domainConfig] = await Promise.all([
      getImageInfo(uuid as string),
      getSystemConfig('storage', 'custom_domain').catch(() => null)
    ])
    if (domainConfig?.value) {
      customDomain.value = domainConfig.value
    }
    if (!info) {
      error.value = true
    } else {
      imageData.value = info
    }
  } catch (e) {
    console.error('获取图片信息失败:', e)
    error.value = true
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchImageInfo()
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
/* ===== 基础 ===== */
.page {
  position: relative;
  min-height: 100%;
  width: 100%;
  background: #0b0b0c;
  color: #d4d4d4;
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI',
    'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
}

.page > *:not(.ambient-bg) {
  position: relative;
  z-index: 1;
  max-width: 880px;
  margin-left: auto;
  margin-right: auto;
  padding-left: 28px;
  padding-right: 28px;
}

/* ===== 氛围背景 ===== */
.ambient-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}

.ambient-img {
  position: absolute;
  width: 110%;
  height: 70%;
  top: -5%;
  left: -5%;
  object-fit: cover;
  filter: blur(80px) saturate(1.6) brightness(0.35);
  opacity: 0;
  animation: ambient-in 1.2s ease forwards 0.3s;
}

@keyframes ambient-in {
  to { opacity: 0.5; }
}

/* 底部渐变遮罩，让氛围光自然淡出 */
.ambient-bg::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    transparent 0%,
    rgba(11, 11, 12, 0.3) 40%,
    #0b0b0c 70%
  );
}

/* ===== 加载器 ===== */
.loader {
  width: 28px;
  height: 28px;
  border: 2px solid rgba(255, 255, 255, 0.08);
  border-top-color: rgba(255, 255, 255, 0.5);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ===== 状态页 ===== */
.state-center {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 65vh;
}

.state-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.state-icon { color: #444; }

.state-title {
  font-size: 17px;
  font-weight: 600;
  color: #bbb;
}

.state-text {
  font-size: 13px;
  color: #555;
}

/* ===== 通用按钮 ===== */
.btn-ghost {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 14px;
  font-size: 13px;
  font-weight: 500;
  color: #888;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 10px;
  cursor: pointer;
  transition: color 0.2s, background 0.2s, border-color 0.2s;
  font-family: inherit;
  line-height: 1;
}

.btn-ghost:hover {
  color: #ddd;
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.12);
}

/* ===== 导航 ===== */
.nav {
  padding-top: 22px;
  padding-bottom: 18px;
}

/* ===== 图片展示 ===== */
.hero {
  padding-bottom: 28px;
}

.frame {
  position: relative;
  width: 100%;
  min-height: 220px;
  border-radius: 14px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.3s, box-shadow 0.4s;
}

.frame.loaded {
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5);
}

.frame.loaded:hover {
  border-color: rgba(255, 255, 255, 0.12);
  box-shadow: 0 12px 50px rgba(0, 0, 0, 0.6);
}

.hero-img {
  width: 100%;
  max-height: 76vh;
  object-fit: contain;
  display: block;
  transition: transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94),
              filter 0.4s ease;
}

.frame:hover .hero-img {
  transform: scale(1.015);
  filter: brightness(0.65);
}

.frame-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 100px 0;
  width: 100%;
}

.frame-error-text {
  color: #444;
  font-size: 13px;
}

/* hover 遮罩 */
.frame-hover {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  pointer-events: none;
}

.frame:hover .frame-hover {
  opacity: 1;
}

.hover-pill {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 10px 20px;
  font-size: 13px;
  font-weight: 500;
  color: #fff;
  background: rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 24px;
  letter-spacing: 0.3px;
}

.fade-fast-enter-active { transition: opacity 0.25s ease; }
.fade-fast-leave-active { transition: opacity 0.2s ease; }
.fade-fast-enter-from,
.fade-fast-leave-to { opacity: 0; }

/* ===== 信息面板 ===== */
.panel {
  padding-bottom: 60px;
}

.panel-main {
  padding: 28px 30px;
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(20px) saturate(1.3);
  -webkit-backdrop-filter: blur(20px) saturate(1.3);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 16px;
  margin-bottom: 12px;
}

.panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.title {
  font-size: 22px;
  font-weight: 700;
  line-height: 1.35;
  color: #f0f0f0;
  margin: 0;
  letter-spacing: -0.3px;
  flex: 1;
  min-width: 0;
}

/* 状态胶囊 */
.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 20px;
  letter-spacing: 0.3px;
  white-space: nowrap;
  flex-shrink: 0;
}

.sp-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
}

.sp-done { color: #4ade80; background: rgba(74, 222, 128, 0.1); }
.sp-done .sp-dot { background: #4ade80; }

.sp-processing { color: #fbbf24; background: rgba(251, 191, 36, 0.1); }
.sp-processing .sp-dot { background: #fbbf24; animation: pulse-dot 1.6s ease-in-out infinite; }

.sp-uploading { color: #60a5fa; background: rgba(96, 165, 250, 0.1); }
.sp-uploading .sp-dot { background: #60a5fa; animation: pulse-dot 1.6s ease-in-out infinite; }

.sp-failed { color: #f87171; background: rgba(248, 113, 113, 0.1); }
.sp-failed .sp-dot { background: #f87171; }

@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.35; transform: scale(0.8); }
}

/* 标签行 */
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 18px;
}

.tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 500;
  padding: 4px 11px;
  border-radius: 7px;
  transition: background 0.2s;
}

.tag-type {
  color: #c4b5fd;
  background: rgba(196, 181, 253, 0.08);
}

.tag-time {
  color: #94a3b8;
  background: rgba(148, 163, 184, 0.07);
}

.tag-camera {
  color: #5eead4;
  background: rgba(94, 234, 212, 0.07);
}

.tag:hover {
  background: rgba(255, 255, 255, 0.06);
}

/* 描述 */
.desc {
  margin: 0;
  font-size: 14px;
  line-height: 1.85;
  color: #999;
}

/* 文件信息网格 */
.meta-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 14px;
  overflow: hidden;
}

.meta-cell {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 18px 22px;
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  border-right: 1px solid rgba(255, 255, 255, 0.04);
  transition: background 0.2s;
}

.meta-cell:nth-child(even) {
  border-right: none;
}

.meta-cell:nth-last-child(-n+2) {
  border-bottom: none;
}

.meta-cell:hover {
  background: rgba(255, 255, 255, 0.04);
}

.meta-label {
  font-size: 11px;
  font-weight: 600;
  color: #555;
  text-transform: uppercase;
  letter-spacing: 0.8px;
}

.meta-value {
  font-size: 13.5px;
  font-weight: 500;
  color: #bbb;
  word-break: break-all;
  line-height: 1.45;
}

.mv-done { color: #4ade80; }
.mv-processing { color: #fbbf24; }
.mv-uploading { color: #60a5fa; }
.mv-failed { color: #f87171; }

/* ===== 全屏预览 ===== */
.lightbox {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: rgba(0, 0, 0, 0.96);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 40px;
}

.lightbox-img {
  max-width: 95vw;
  max-height: 92vh;
  object-fit: contain;
  cursor: default;
  border-radius: 4px;
  user-select: none;
}

.lightbox-close {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  cursor: pointer;
  transition: color 0.2s, background 0.2s;
  font-family: inherit;
}

.lightbox-close:hover {
  color: #eee;
  background: rgba(255, 255, 255, 0.12);
}

.lightbox-caption {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  color: #888;
  font-size: 13px;
  padding: 6px 20px;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-radius: 20px;
  max-width: 80%;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 预览过渡 */
.preview-enter-active {
  transition: opacity 0.3s ease;
}
.preview-enter-active .lightbox-img {
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease;
}
.preview-leave-active {
  transition: opacity 0.2s ease;
}
.preview-enter-from {
  opacity: 0;
}
.preview-enter-from .lightbox-img {
  opacity: 0;
  transform: scale(0.95);
}
.preview-leave-to {
  opacity: 0;
}

/* ===== 响应式 ===== */
@media (max-width: 640px) {
  .page > *:not(.ambient-bg) {
    padding-left: 16px;
    padding-right: 16px;
  }

  .nav { padding-top: 14px; padding-bottom: 12px; }

  .title { font-size: 19px; }

  .frame {
    border-radius: 10px;
    min-height: 160px;
  }

  .panel-main {
    padding: 22px 20px;
    border-radius: 14px;
  }

  .panel-header {
    flex-direction: column;
    gap: 10px;
  }

  .meta-grid { grid-template-columns: 1fr; }

  .meta-cell { border-right: none !important; }
  .meta-cell:last-child { border-bottom: none; }

  .lightbox { padding: 16px; }

  .hero { padding-bottom: 20px; }
}
</style>

<template>
  <div class="video-player-container">
    <video-player
      ref="videoPlayerRef"
      :poster="poster"
      :controls="true"
      :playback-rates="playbackRates"
      :fluid="true"
      :aspect-ratio="'16:9'"
      :picture-in-picture="true"
      class="video-js vjs-big-play-centered theme-archive"
      @mounted="handleMounted"
      @ready="handleReady"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, onBeforeUnmount, onMounted, watch } from 'vue'
import { VideoPlayer } from '@videojs-player/vue'
import videojs from 'video.js'
import type Player from 'video.js/dist/types/player'
import type Component from 'video.js/dist/types/component'
import type MenuButtonType from 'video.js/dist/types/menu/menu-button'
import type MenuItemType from 'video.js/dist/types/menu/menu-item'

type GalleryPlayer = Player & {
  controlBar: Component
  _customCleanup?: () => void
}
type QualityOptions = {
  label: string
  qualityLabel: string
  qualityIndex: number
}
// Video.js discovers custom components at runtime; its base declaration loses the subtype.
type QualityButton = Component & {
  items: Array<MenuItemType & { qualityIndex: number }>
  update(): void
  updateButtonText(): void
}

import 'video.js/dist/video-js.css'
import type { VideoSource } from '../types/video'

interface Props {
  poster?: string
  videoSources: VideoSource[]
}

const props = withDefaults(defineProps<Props>(), {
  poster: ''
})

const emit = defineEmits<{ playing: []; pause: [] }>()

const sources = ref<VideoSource[]>(props.videoSources)
const playbackRates = ref([0.5, 0.75, 1, 1.25, 1.5, 2])

// 状态
const videoPlayerRef = ref(null)
const player = shallowRef<GalleryPlayer | null>(null)
const currentQuality = ref(0)
let qualityButton: QualityButton | null = null
let cancelQualitySwitch: (() => void) | null = null
// 同步 props 到本地状态，并在数据变化时纠正 currentQuality
watch(
  () => props.videoSources,
  (val) => {
    sources.value = Array.isArray(val) ? val : []
    if (currentQuality.value >= sources.value.length) {
      currentQuality.value = 0
    }
  },
  { immediate: true, deep: true }
)
// Manage sources here so the wrapper does not load the same source again when
// currentQuality changes. Metadata can also arrive after the player is ready.
const syncSources = () => {
  const instance = player.value
  if (!instance || instance.isDisposed()) return
  cancelQualitySwitch?.()
  syncQualityButton(true)
  const source = sources.value[currentQuality.value]
  if (source?.src && instance.currentSrc() !== source.src) {
    instance.src({ src: source.src, type: source.type })
    instance.load()
  }
}
watch(sources, syncSources, { deep: true, flush: 'post' })
watch(player, syncSources, { flush: 'post' })

watch(currentQuality, () => qualityButton?.updateButtonText(), {
  flush: 'sync'
})

// 键盘事件处理
const handleKeydown = (event: KeyboardEvent) => {
  if (!player.value) return

  // 如果焦点在输入框或文本区域，不处理键盘事件
  const target = event.target as HTMLElement
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
    return
  }

  switch (event.code) {
    case 'Space':
      // 空格键：播放/暂停
      event.preventDefault()
      if (player.value.paused()) {
        player.value.play()
      } else {
        player.value.pause()
      }
      break

    case 'ArrowLeft':
      // 左方向键：后退5秒
      event.preventDefault()
      const currentTimeLeft = player.value.currentTime() ?? 0
      player.value.currentTime(Math.max(0, currentTimeLeft - 3))
      break

    case 'ArrowRight':
      // 右方向键：前进5秒
      event.preventDefault()
      const currentTimeRight = player.value.currentTime() ?? 0
      const duration = player.value.duration() ?? 0
      player.value.currentTime(Math.min(duration, currentTimeRight + 3))
      break

    case 'ArrowUp':
      // 上方向键：增加音量（可选）
      event.preventDefault()
      const currentVolume = player.value.volume() ?? 1
      player.value.volume(Math.min(1, currentVolume + 0.1))
      break

    case 'ArrowDown':
      // 下方向键：减少音量（可选）
      event.preventDefault()
      const volume = player.value.volume() ?? 1
      player.value.volume(Math.max(0, volume - 0.1))
      break
  }
}

// 创建清晰度选择组件
const createQualityComponents = () => {
  const MenuButton = videojs.getComponent(
    'MenuButton'
  ) as unknown as typeof MenuButtonType
  const MenuItem = videojs.getComponent('MenuItem') as typeof MenuItemType

  // 清晰度菜单项
  class QualityMenuItem extends MenuItem {
    qualityIndex: number
    qualityLabel: string
    constructor(player: Player, options: QualityOptions) {
      super(player, { ...options, selectable: true })
      this.qualityIndex = options.qualityIndex
      this.qualityLabel = options.qualityLabel
      this.selected(this.qualityIndex === currentQuality.value)
    }

    handleClick() {
      const source = sources.value[this.qualityIndex]
      const previousSource = sources.value[currentQuality.value]
      if (
        !source ||
        !previousSource ||
        this.qualityIndex === currentQuality.value
      ) {
        return
      }

      cancelQualitySwitch?.()
      const instance = this.player()
      const previousQuality = currentQuality.value
      const currentTime = instance.currentTime() ?? 0
      const wasPaused = instance.paused()
      const currentRate = instance.playbackRate() ?? 1
      const hadStarted = instance.hasClass('vjs-has-started')

      const restorePlayback = () => {
        instance.currentTime(currentTime)
        instance.playbackRate(currentRate)
        instance.hasStarted(hadStarted)
        if (!wasPaused) {
          instance.play()?.catch((error: Error) => {
            // A new switch or pause can cancel the pending playback request.
            if (error.name !== 'AbortError')
              console.error('恢复播放失败:', error)
          })
        }
      }

      const cleanup = () => {
        instance.off('loadedmetadata', onLoadedMetadata)
        instance.off('loadedmetadata', onFallbackLoaded)
        instance.off('error', onError)
        if (cancelQualitySwitch === cleanup) cancelQualitySwitch = null
      }

      // 先更新选中状态和索引
      currentQuality.value = this.qualityIndex

      // 监听加载成功
      const onLoadedMetadata = () => {
        cleanup()
        restorePlayback()
      }

      const onFallbackLoaded = () => {
        cleanup()
        restorePlayback()
      }

      // 监听加载失败
      const onError = () => {
        console.error(`清晰度 ${source.label} 加载失败:`, instance.error())
        cleanup()

        // 回退到之前的清晰度
        currentQuality.value = previousQuality
        cancelQualitySwitch = cleanup
        instance.one('loadedmetadata', onFallbackLoaded)
        instance.src({ src: previousSource.src, type: previousSource.type })

        // 显示错误提示（可选）
        instance.trigger('qualitySwitchError', {
          attemptedQuality: source.label,
          fallbackQuality: previousSource.label
        })
      }

      // 添加监听
      cancelQualitySwitch = cleanup
      instance.one('loadedmetadata', onLoadedMetadata)
      instance.one('error', onError)
      instance.src({ src: source.src, type: source.type })
    }
  }

  // 清晰度菜单按钮
  class QualityMenuButton extends MenuButton {
    constructor(player: Player, options: Record<string, unknown>) {
      super(player, options)
      this.addClass('vjs-quality-button')
    }

    createEl() {
      const el = super.createEl()
      return el
    }

    buildCSSClass() {
      return `vjs-quality-menu-button ${super.buildCSSClass()}`
    }

    createItems() {
      // 确保有视频源才创建菜单项
      if (!sources.value.length) {
        return []
      }
      const items = sources.value.map((source, index) => {
        return new QualityMenuItem(this.player(), {
          label: source.label,
          qualityLabel: source.label,
          qualityIndex: index
        })
      })
      return items
    }

    updateButtonText() {
      const items = (this as unknown as QualityButton).items
      items?.forEach((item) =>
        item.selected(item.qualityIndex === currentQuality.value)
      )
      // 安全检查：确保 sources 和当前索引有效
      if (!sources.value.length || !sources.value[currentQuality.value]) {
        return
      }
      const currentLabel = sources.value[currentQuality.value].label
      const iconEl = this.el().querySelector('.vjs-icon-placeholder')
      if (iconEl) {
        iconEl.setAttribute('data-quality', currentLabel)
      }
      const labelEl = this.el().querySelector('.vjs-menu-button-text')
      if (labelEl) {
        labelEl.textContent = currentLabel
      }
    }
  }

  // Keep the component local: each player's menu closes over its own sources.
  return QualityMenuButton
}

const syncQualityButton = (rebuildMenu = false) => {
  const instance = player.value
  if (!instance || instance.isDisposed() || !instance._customCleanup) return

  const controlBar = instance.controlBar
  if (sources.value.length <= 1) {
    if (qualityButton) {
      controlBar.removeChild(qualityButton)
      qualityButton.dispose()
      qualityButton = null
    }
    return
  }

  if (!qualityButton) {
    const QualityMenuButton = createQualityComponents()
    const nextControl =
      controlBar.getChild('PictureInPictureToggle') ||
      controlBar.getChild('FullscreenToggle')
    const insertIndex = nextControl
      ? controlBar.children().indexOf(nextControl)
      : controlBar.children().length
    qualityButton = controlBar.addChild(
      new QualityMenuButton(instance, {}) as unknown as Component,
      {},
      insertIndex
    ) as QualityButton
  } else if (rebuildMenu) {
    qualityButton.update()
  }
  qualityButton.updateButtonText()
}

// 生命周期
onMounted(() => {
  // 添加键盘事件监听
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  // 移除键盘事件监听
  window.removeEventListener('keydown', handleKeydown)
  cancelQualitySwitch?.()
  qualityButton = null

  if (player.value) {
    // 调用自定义清理函数
    if (player.value._customCleanup) {
      player.value._customCleanup()
    }
    player.value.dispose()
  }
})

// 事件处理
const handleMounted = ({ player: videoPlayer }: { player: Player }) => {
  player.value = videoPlayer as GalleryPlayer
  console.log('播放器已挂载')
}

const handleReady = () => {
  console.log('播放器已就绪')

  const instance = player.value
  if (!instance || instance.isDisposed()) return
  // Video.js emits ready again after loading a new source. Setup must be
  // idempotent so both controls and event handlers remain unique.
  if (instance._customCleanup) {
    syncQualityButton()
    return
  }

  try {
    // 设置用户不活动超时时间（1秒后隐藏控制栏）
    instance.options_.inactivityTimeout = 1000

    // 确保控制栏自动隐藏功能启用
    instance.options({
      userActions: {
        hotkeys: false // 禁用默认热键，使用我们自定义的
      }
    })

    // 手动触发用户活动，确保控制栏显示逻辑正常
    instance.userActive(true)

    const controlBar = instance.controlBar

    const volumePanel = controlBar.getChild('VolumePanel')

    if (volumePanel) {
      controlBar.removeChild(volumePanel)
      const playbackRateMenu = controlBar.getChild('PlaybackRateMenuButton')

      if (playbackRateMenu) {
        const playbackRateIndex = controlBar
          .children()
          .indexOf(playbackRateMenu)
        controlBar.addChild(volumePanel, {}, playbackRateIndex)
      } else {
        const insertIndex = controlBar.children().length - 1
        controlBar.addChild(volumePanel, {}, insertIndex)
      }
    }

    // 移除 Video.js 控件聚焦问题并设置鼠标事件
    const playerEl = instance.el()

    // 捕获所有 focus 事件
    const handleFocus = (e: Event) => {
      const target = e.target as HTMLElement
      if (
        target.classList.contains('vjs-control') || // 普通控件
        target.closest('.vjs-menu-button') || // 菜单类控件（倍速、清晰度等）
        target.classList.contains('vjs-picture-in-picture-control') ||
        target.classList.contains('vjs-fullscreen-control')
      ) {
        target.blur()
        e.stopPropagation()
      }
    }
    playerEl.addEventListener('focus', handleFocus, true)

    // 重要：移除之前可能存在的监听器，然后添加新的
    let inactivityTimer: ReturnType<typeof setTimeout> | null = null
    let rafId: number | null = null

    const resetInactivityTimer = () => {
      if (inactivityTimer) {
        clearTimeout(inactivityTimer)
      }
      instance.userActive(true)
      inactivityTimer = setTimeout(() => {
        instance.userActive(false)
      }, 1000)
    }

    // 节流 mousemove，避免播放时主线程被频繁调用导致卡顿
    const throttledResetInactivity = () => {
      if (rafId !== null) return
      rafId = requestAnimationFrame(() => {
        rafId = null
        resetInactivityTimer()
      })
    }

    const handleMouseLeave = () => {
      if (inactivityTimer) {
        clearTimeout(inactivityTimer)
        inactivityTimer = null
      }
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
      instance.userActive(false)
    }

    const handleMouseEnter = () => {
      resetInactivityTimer()
    }

    playerEl.addEventListener('mousemove', throttledResetInactivity)
    playerEl.addEventListener('mouseleave', handleMouseLeave)
    playerEl.addEventListener('mouseenter', handleMouseEnter)

    const onPlay = () => emit('playing')
    const onPause = () => emit('pause')
    instance.on('play', onPlay)
    instance.on('pause', onPause)

    // 清理函数（使用同一引用才能正确移除监听）
    const cleanup = () => {
      if (inactivityTimer) {
        clearTimeout(inactivityTimer)
        inactivityTimer = null
      }
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
      instance.off('play', onPlay)
      instance.off('pause', onPause)
      playerEl.removeEventListener('focus', handleFocus, true)
      playerEl.removeEventListener('mousemove', throttledResetInactivity)
      playerEl.removeEventListener('mouseleave', handleMouseLeave)
      playerEl.removeEventListener('mouseenter', handleMouseEnter)
    }

    // 保存清理函数以便后续使用
    instance._customCleanup = cleanup
    syncQualityButton()
  } catch (error) {
    console.error('初始化清晰度按钮失败:', error)
  }
}
</script>

<style>
/* 独立合成层，减少与页面动画的相互重绘，缓解播放卡顿 */
.video-player-container {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  transform: translateZ(0);
  contain: layout style;
}

/* 固定 16:9 视窗，竖屏视频两侧黑边（pillarbox），横屏正常或上下黑边（letterbox） */
.video-player-container .video-js {
  background: #000;
}
.video-player-container .video-js .vjs-tech,
.video-player-container .video-js video {
  object-fit: contain;
  background: #000;
}

/* 绿色主题样式 */
.theme-archive {
  --theme-accent: #64c7e1;
  --theme-accent-dark: #3294ae;
  --theme-accent-light: #b5e7f3;
}

/* 控制栏尺寸调整 */
.theme-archive .vjs-control-bar {
  height: 3.5em;
  font-size: 14px;
  background: rgba(0, 0, 0, 0);
}

/* 按钮尺寸 */
.theme-archive .vjs-control {
  width: 3.5em;
}

/* 大播放按钮 - 绿色 */
.theme-archive .vjs-big-play-button {
  background-color: rgba(100, 199, 225, 0.7);
  border: 0.06666em solid rgba(100, 199, 225, 0.8);
  border-radius: 50%;
  width: 2em;
  height: 2em;
  line-height: 2em;
  font-size: 3em;
  transition: all 0.3s;
}

.theme-archive .vjs-big-play-button:hover {
  background-color: rgba(100, 199, 225, 0.8);
  border-color: #b5e7f3;
  transform: scale(1.1);
}

/* 进度条 */
.theme-archive .vjs-progress-holder {
  height: 0.5em;
}

.theme-archive .vjs-play-progress {
  background-color: #64c7e1;
}

.theme-archive .vjs-play-progress:before {
  color: #b5e7f3;
  font-size: 1.2em;
  text-shadow: 0 0 0.5em rgba(100, 199, 225, 0.8);
}

.theme-archive .vjs-load-progress {
  background: rgba(100, 199, 225, 0.3);
}

/* 音量条 */
.theme-archive .vjs-volume-level {
  background-color: #64c7e1;
}

.theme-archive .vjs-volume-level:before {
  color: #b5e7f3;
}

/* 按钮悬停效果 */
.theme-archive .vjs-control:hover {
  color: #b5e7f3;
  text-shadow: 0 0 0.5em rgba(100, 199, 225, 0.5);
}

/* 菜单背景半透明 */
.theme-archive .vjs-menu .vjs-menu-content {
  background-color: rgba(101, 255, 124, 0.1);
}

/* 菜单项选中状态 */
.theme-archive .vjs-menu li.vjs-selected,
.theme-archive .vjs-menu li.vjs-selected:focus,
.theme-archive .vjs-menu li.vjs-selected:hover {
  background-color: rgba(100, 199, 225, 0.6);
  color: #fff;
}

/* 菜单项悬停 */
.theme-archive .vjs-menu li:hover {
  background-color: rgba(100, 199, 225, 0.3);
}

/* 时间提示 */
.theme-archive .vjs-time-tooltip,
.theme-archive .vjs-mouse-display .vjs-time-tooltip {
  background-color: rgba(100, 199, 225, 0.9);
  color: #fff;
  border-radius: 0;
}

/* 清晰度按钮样式 */
.vjs-quality-menu-button.vjs-menu-button {
  font-family: inherit;
}

/* 清晰度按钮样式 - 动态显示当前清晰度 */
.vjs-quality-menu-button .vjs-icon-placeholder::before {
  content: attr(data-quality);
  font-size: 1.2em;
  font-weight: bold;
  line-height: 2.5;
}

.vjs-quality-menu-button .vjs-menu-button-text {
  display: none;
}

/* 菜单项样式 */
.vjs-quality-menu-button .vjs-menu .vjs-menu-item {
  text-transform: none;
  font-size: 1em;
}

.theme-archive .vjs-quality-menu-button .vjs-menu .vjs-menu-item.vjs-selected {
  background-color: rgba(100, 199, 225, 0.6);
  color: #fff;
}

.vjs-quality-menu-button .vjs-menu .vjs-menu-item.vjs-selected::before {
  content: '✓ ';
  color: #b5e7f3;
}

/* 确保播放速度按钮显示 */
.vjs-playback-rate {
  display: block !important;
}

.vjs-playback-rate .vjs-playback-rate-value {
  font-size: 1.2em;
  line-height: 2.5;
}

/* 确保时间显示 */
.vjs-current-time,
.vjs-time-divider,
.vjs-duration {
  display: block !important;
}

/* 确保控制栏在非活动时隐藏 */
.video-js.vjs-user-inactive .vjs-control-bar {
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s;
}

.video-js.vjs-user-active .vjs-control-bar {
  opacity: 1;
  pointer-events: auto;
}

/* 响应式 */
@media (max-width: 768px) {
  .theme-archive .vjs-control-bar {
    font-size: 12px;
  }

  .vjs-quality-menu-button .vjs-icon-placeholder::before {
    font-size: 1.3em;
  }

  .vjs-quality-menu-button .vjs-menu-button-text {
    display: none;
  }
}
</style>

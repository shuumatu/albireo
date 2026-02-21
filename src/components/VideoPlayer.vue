<template>
  <div class="video-player-container">
    <video-player
      ref="videoPlayerRef"
      :src="currentSource?.src || ''"
      :poster="poster"
      :controls="true"
      :playback-rates="playbackRates"
      :fluid="true"
      :aspect-ratio="'16:9'"
      :picture-in-picture="true"
      class="video-js vjs-big-play-centered theme-green"
      @mounted="handleMounted"
      @ready="handleReady"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeUnmount, onMounted, watch} from 'vue'
import { VideoPlayer } from '@videojs-player/vue'
import videojs from 'video.js'
import 'video.js/dist/video-js.css'
import type { VideoSource } from '../types/video'

interface Props {
  poster?: string
  videoSources: VideoSource[]
}

const props = withDefaults(defineProps<Props>(), {
  poster: ''
})

const sources = ref<VideoSource[]>(props.videoSources)
const playbackRates = ref([0.5, 0.75, 1, 1.25, 1.5, 2])

// 状态
const videoPlayerRef = ref(null)
const player = ref(null)
const currentQuality = ref(0)
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
// 当前选中的视频源
const currentSource = computed(() => sources.value[currentQuality.value])

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
      const currentTimeLeft = player.value.currentTime()
      player.value.currentTime(Math.max(0, currentTimeLeft - 3))
      break
      
    case 'ArrowRight':
      // 右方向键：前进5秒
      event.preventDefault()
      const currentTimeRight = player.value.currentTime()
      const duration = player.value.duration()
      player.value.currentTime(Math.min(duration, currentTimeRight + 3))
      break
      
    case 'ArrowUp':
      // 上方向键：增加音量（可选）
      event.preventDefault()
      const currentVolume = player.value.volume()
      player.value.volume(Math.min(1, currentVolume + 0.1))
      break
      
    case 'ArrowDown':
      // 下方向键：减少音量（可选）
      event.preventDefault()
      const volume = player.value.volume()
      player.value.volume(Math.max(0, volume - 0.1))
      break
  }
}

// 创建清晰度选择组件
const createQualityComponents = (playerInstance) => {
  const MenuButton = videojs.getComponent('MenuButton')
  const MenuItem = videojs.getComponent('MenuItem')

  // 清晰度菜单项
class QualityMenuItem extends MenuItem {
  constructor(player, options) {
    super(player, options)
    this.qualityIndex = options.qualityIndex
    this.qualityLabel = options.qualityLabel
    this.selected(this.qualityIndex === currentQuality.value)
  }

  handleClick() {
    if (this.qualityIndex === currentQuality.value) {
      return
    }

    const previousQuality = currentQuality.value
    const currentTime = this.player().currentTime()
    const wasPaused = this.player().paused()
    const currentRate = this.player().playbackRate()

    // 先更新选中状态和索引
    currentQuality.value = this.qualityIndex
    
    this.player().src({
      src: sources.value[this.qualityIndex].src,
      type: sources.value[this.qualityIndex].type
    })
    
    // 监听加载成功
    const onLoadedMetadata = () => {
      this.player().currentTime(currentTime)
      this.player().playbackRate(currentRate)
      if (!wasPaused) {
        this.player().play()
      }
      // 清除错误监听
      this.player().off('error', onError)
    }
    
    // 监听加载失败
    const onError = () => {
      const error = this.player().error()
      console.error(`清晰度 ${sources.value[this.qualityIndex].label} 加载失败:`, error)
      
      // 清除成功监听
      this.player().off('loadedmetadata', onLoadedMetadata)
      
      // 回退到之前的清晰度
      currentQuality.value = previousQuality
      console.log(`回退到 ${sources.value[previousQuality].label}`)
      
      this.player().src({
        src: sources.value[previousQuality].src,
        type: sources.value[previousQuality].type
      })
      
      // 恢复播放状态
      this.player().one('loadedmetadata', () => {
        this.player().currentTime(currentTime)
        this.player().playbackRate(currentRate)
        if (!wasPaused) {
          this.player().play()
        }
      })
      
      // 显示错误提示（可选）
      this.player().trigger('qualitySwitchError', {
        attemptedQuality: sources.value[this.qualityIndex].label,
        fallbackQuality: sources.value[previousQuality].label
      })
    }
    
    // 添加监听
    this.player().one('loadedmetadata', onLoadedMetadata)
    this.player().one('error', onError)
    
    // 更新菜单选中状态
    const menuItems = this.player().controlBar.getChild('qualityMenuButton').items
    menuItems.forEach(item => {
      item.selected(item.qualityIndex === this.qualityIndex)
    })
    
    const button = this.player().controlBar.getChild('qualityMenuButton')
    button.updateButtonText()
  }
}

  // 清晰度菜单按钮
  class QualityMenuButton extends MenuButton {
    constructor(player, options) {
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

  videojs.registerComponent('QualityMenuButton', QualityMenuButton)
}

// 生命周期
onMounted(() => {
  // 添加键盘事件监听
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  // 移除键盘事件监听
  window.removeEventListener('keydown', handleKeydown)
  
  if (player.value) {
    // 调用自定义清理函数
    if (player.value._customCleanup) {
      player.value._customCleanup()
    }
    player.value.dispose()
  }
})

// 事件处理
const handleMounted = ({ player: videoPlayer }) => {
  player.value = videoPlayer
  console.log('播放器已挂载')
}

const handleReady = () => {
  console.log('播放器已就绪')
  
  if (!player.value || !sources.value.length) {
    console.warn('播放器或视频源未就绪')
    return
  }
  
  try {
    // 设置用户不活动超时时间（1秒后隐藏控制栏）
    player.value.options_.inactivityTimeout = 1000
    
    // 确保控制栏自动隐藏功能启用
    player.value.options({
      userActions: {
        hotkeys: false // 禁用默认热键，使用我们自定义的
      }
    })
    
    // 手动触发用户活动，确保控制栏显示逻辑正常
    player.value.userActive(true)
    
    createQualityComponents(player.value)
    
    const controlBar = player.value.controlBar

    
    const volumePanel = controlBar.getChild('VolumePanel')
    
    if (volumePanel) {
      controlBar.removeChild(volumePanel)
      const playbackRateMenu = controlBar.getChild('PlaybackRateMenuButton')
      
      if (playbackRateMenu) {
        const playbackRateIndex = controlBar.children().indexOf(playbackRateMenu)
        controlBar.addChild(volumePanel, {}, playbackRateIndex)
      } else {
        const insertIndex = controlBar.children().length - 1
        controlBar.addChild(volumePanel, {}, insertIndex)
      }
    }

    const pipToggle = controlBar.getChild('PictureInPictureToggle')
    const fullscreenToggle = controlBar.getChild('FullscreenToggle')
    
    let insertIndex
    if (pipToggle) {
      insertIndex = controlBar.children().indexOf(pipToggle)
    } else if (fullscreenToggle) {
      insertIndex = controlBar.children().indexOf(fullscreenToggle)
    } else {
      insertIndex = controlBar.children().length
    }
    
    const qualityButton = controlBar.addChild('QualityMenuButton', {}, insertIndex)
    
    setTimeout(() => {
      qualityButton.updateButtonText()
    }, 0)
    
    console.log('清晰度按钮已添加到控制栏')
    
    // 移除 Video.js 控件聚焦问题并设置鼠标事件
    const playerEl = player.value.el()

    // 捕获所有 focus 事件
    playerEl.addEventListener(
      'focus',
      (e) => {
        const target = e.target as HTMLElement
        if (
          target.classList.contains('vjs-control') || // 普通控件
          target.closest('.vjs-menu-button') ||       // 菜单类控件（倍速、清晰度等）
          target.classList.contains('vjs-picture-in-picture-control') ||
          target.classList.contains('vjs-fullscreen-control')
        ) {
          target.blur()
          e.stopPropagation()
        }
      },
      true // ⚠️ 使用捕获阶段，确保在 Video.js 内部处理前生效
    )
    
    // 重要：移除之前可能存在的监听器，然后添加新的
    let inactivityTimer = null
    
    const resetInactivityTimer = () => {
      if (inactivityTimer) {
        clearTimeout(inactivityTimer)
      }
      player.value.userActive(true)
      
      // 1秒后设置为不活动
      inactivityTimer = setTimeout(() => {
        player.value.userActive(false)
      }, 1000)
    }
    
    // 监听鼠标移动
    playerEl.addEventListener('mousemove', resetInactivityTimer)
    
    // 鼠标离开立即隐藏
    playerEl.addEventListener('mouseleave', () => {
      if (inactivityTimer) {
        clearTimeout(inactivityTimer)
      }
      player.value.userActive(false)
    })
    
    // 鼠标进入显示控制栏
    playerEl.addEventListener('mouseenter', () => {
      resetInactivityTimer()
    })
    
    // 清理函数
    const cleanup = () => {
      if (inactivityTimer) {
        clearTimeout(inactivityTimer)
      }
      playerEl.removeEventListener('mousemove', resetInactivityTimer)
      playerEl.removeEventListener('mouseleave', () => {})
      playerEl.removeEventListener('mouseenter', () => {})
    }
    
    // 保存清理函数以便后续使用
    player.value._customCleanup = cleanup

  } catch (error) {
    console.error('初始化清晰度按钮失败:', error)
  }
}
</script>

<style>
.video-player-container {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
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
.theme-green {
  --theme-green: #00d084;
  --theme-green-dark: #00a86b;
  --theme-green-light: #00f5a0;
}

/* 控制栏尺寸调整 */
.theme-green .vjs-control-bar {
  height: 3.5em;
  font-size: 14px;
  background: rgba(0, 0, 0, 0);
}

/* 按钮尺寸 */
.theme-green .vjs-control {
  width: 3.5em;
}

/* 大播放按钮 - 绿色 */
.theme-green .vjs-big-play-button {
  background-color: rgba(0, 208, 132, 0.7);
  border: 0.06666em solid rgba(0, 208, 132, 0.8);
  border-radius: 50%;
  width: 2em;
  height: 2em;
  line-height: 2em;
  font-size: 3em;
  transition: all 0.3s;
}

.theme-green .vjs-big-play-button:hover {
  background-color: rgba(0, 245, 160, 0.8);
  border-color: #00f5a0;
  transform: scale(1.1);
}

/* 进度条 */
.theme-green .vjs-progress-holder {
  height: 0.5em;
}

.theme-green .vjs-play-progress {
  background-color: #00d084;
}

.theme-green .vjs-play-progress:before {
  color: #00f5a0;
  font-size: 1.2em;
  text-shadow: 0 0 0.5em rgba(0, 245, 160, 0.8);
}

.theme-green .vjs-load-progress {
  background: rgba(0, 208, 132, 0.3);
}

/* 音量条 */
.theme-green .vjs-volume-level {
  background-color: #00d084;
}

.theme-green .vjs-volume-level:before {
  color: #00f5a0;
}

/* 按钮悬停效果 */
.theme-green .vjs-control:hover {
  color: #00f5a0;
  text-shadow: 0 0 0.5em rgba(0, 245, 160, 0.5);
}

/* 菜单背景半透明 */
.theme-green .vjs-menu .vjs-menu-content{
  background-color: rgba(101, 255, 124, 0.1);
}

/* 菜单项选中状态 */
.theme-green .vjs-menu li.vjs-selected,
.theme-green .vjs-menu li.vjs-selected:focus,
.theme-green .vjs-menu li.vjs-selected:hover {
  background-color: rgba(0, 208, 132, 0.6);
  color: #fff;
}

/* 菜单项悬停 */
.theme-green .vjs-menu li:hover {
  background-color: rgba(0, 208, 132, 0.3);
}

/* 时间提示 */
.theme-green .vjs-time-tooltip,
.theme-green .vjs-mouse-display .vjs-time-tooltip {
  background-color: rgba(0, 208, 132, 0.9);
  color: #fff;
  border-radius: 0.3em;
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

.theme-green .vjs-quality-menu-button .vjs-menu .vjs-menu-item.vjs-selected {
  background-color: rgba(0, 208, 132, 0.6);
  color: #fff;
}

.vjs-quality-menu-button .vjs-menu .vjs-menu-item.vjs-selected::before {
  content: "✓ ";
  color: #00f5a0;
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
  .theme-green .vjs-control-bar {
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
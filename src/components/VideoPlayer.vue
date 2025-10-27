<template>
  <div class="video-player-container">
    <video-player
      ref="videoPlayerRef"
      :src="currentSource.src"
      :poster="poster"
      :controls="true"
      :playback-rates="playbackRates"
      :fluid="true"
      class="video-js vjs-big-play-centered theme-green"
      @mounted="handleMounted"
      @ready="handleReady"
    />
  </div>
</template>

<script setup>
import { ref, computed, onBeforeUnmount } from 'vue'
import { VideoPlayer } from '@videojs-player/vue'
import videojs from 'video.js'
import 'video.js/dist/video-js.css'



// Props
const props = defineProps({
  poster: {
    type: String,
    default: ''
  }
})

// 视频源配置（不同清晰度）
const sources = ref([
  {
    src: 'https://albireo.shuumatu.com/videos/daa30485ae7b6bdf9a8edd07f72865874276efe80df429f39857328a449edef7/original/_DSC1319_1.mp4',
    label: '原画',
    type: 'video/mp4'
  },
  {
    src: 'https://albireo.shuumatu.com/videos/daa30485ae7b6bdf9a8edd07f72865874276efe80df429f39857328a449edef7/1080p/1080p.mp4',
    label: '1080P',
    type: 'video/mp4'
  },
  {
    src: 'https://albireo.shuumatu.com/videos/daa30485ae7b6bdf9a8edd07f72865874276efe80df429f39857328a449edef7/720p/720p.mp4',
    label: '720P',
    type: 'video/mp4'
  },
  {
    src: 'https://albireo.shuumatu.com/videos/daa30485ae7b6bdf9a8edd07f72865874276efe80df429f39857328a449edef7/480p/480p.mp4',
    label: '480P',
    type: 'video/mp4'
  }
])

// 播放速度选项
const playbackRates = ref([0.5, 0.75, 1, 1.25, 1.5, 2])

// 状态
const videoPlayerRef = ref(null)
const player = ref(null)
const currentQuality = ref(0)

// 当前选中的视频源
const currentSource = computed(() => sources.value[currentQuality.value])

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
      // 如果点击的是当前清晰度，不做任何操作
      if (this.qualityIndex === currentQuality.value) {
        return
      }

      const currentTime = this.player().currentTime()
      const wasPaused = this.player().paused()
      const currentRate = this.player().playbackRate() // 保存当前播放速度

      // 更新当前清晰度
      currentQuality.value = this.qualityIndex
      
      // 切换视频源
      this.player().src({
        src: sources.value[this.qualityIndex].src,
        type: sources.value[this.qualityIndex].type
      })
      
      // 恢复播放状态和进度
      this.player().one('loadedmetadata', () => {
        this.player().currentTime(currentTime)
        this.player().playbackRate(currentRate) // 恢复播放速度
        if (!wasPaused) {
          this.player().play()
        }
      })
      
      // 更新所有菜单项的选中状态
      const menuItems = this.player().controlBar.getChild('qualityMenuButton').items
      menuItems.forEach(item => {
        item.selected(item.qualityIndex === this.qualityIndex)
      })
      
      // 更新按钮显示文本
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
      const currentLabel = sources.value[currentQuality.value].label

       // 更新图标内容
      const iconEl = this.el().querySelector('.vjs-icon-placeholder')
      if (iconEl) {
        iconEl.setAttribute('data-quality', currentLabel)
      }
      // 更新按钮文本
      const labelEl = this.el().querySelector('.vjs-menu-button-text')
      if (labelEl) {
        labelEl.textContent = currentLabel
      }
    }
  }

  // 注册组件
  videojs.registerComponent('QualityMenuButton', QualityMenuButton)
}

// 生命周期
onBeforeUnmount(() => {
  if (player.value) {
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
  
  if (!player.value) return
  
  try {
    // 注册自定义清晰度组件
    createQualityComponents(player.value)
    
    // 获取控制栏
    const controlBar = player.value.controlBar
    
    // 移动音量控制到合适的位置
    // 获取音量面板组件
    const volumePanel = controlBar.getChild('VolumePanel')
    
    if (volumePanel) {
      // 移除音量面板
      controlBar.removeChild(volumePanel)
      
      // 找到播放速度按钮的位置
      const playbackRateMenu = controlBar.getChild('PlaybackRateMenuButton')
      
      if (playbackRateMenu) {
        const playbackRateIndex = controlBar.children().indexOf(playbackRateMenu)
        // 在播放速度按钮之前插入音量控制
        controlBar.addChild(volumePanel, {}, playbackRateIndex)
      } else {
        // 如果找不到播放速度按钮，放在倒数第二的位置
        const insertIndex = controlBar.children().length - 1
        controlBar.addChild(volumePanel, {}, insertIndex)
      }
    }

    // 找到画中画按钮的位置（如果存在）
    const pipToggle = controlBar.getChild('PictureInPictureToggle')
    const fullscreenToggle = controlBar.getChild('FullscreenToggle')
    
    // 计算插入位置
    let insertIndex
    if (pipToggle) {
      insertIndex = controlBar.children().indexOf(pipToggle)
    } else if (fullscreenToggle) {
      insertIndex = controlBar.children().indexOf(fullscreenToggle)
    } else {
      insertIndex = controlBar.children().length
    }
    
    // 添加清晰度按钮
    const qualityButton = controlBar.addChild('QualityMenuButton', {}, insertIndex)
    
    // 初始化按钮文本
    setTimeout(() => {
      qualityButton.updateButtonText()
    }, 0)
    
    console.log('清晰度按钮已添加到控制栏')
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

/* 绿色主题样式 */
.theme-green {
  --theme-green: #00d084;
  --theme-green-dark: #00a86b;
  --theme-green-light: #00f5a0;
}

/* 控制栏尺寸调整 */
.theme-green .vjs-control-bar {
  height: 3.5em; /* 调整控制栏高度，默认是3em */
  font-size: 14px; /* 调整整体字体大小 */
  background: rgba(0, 0, 0, 0); /* 半透明黑色背景 */
}

/* 按钮尺寸 */
.theme-green .vjs-control {
  width: 3.5em; /* 调整按钮宽度 */
}

/* 大播放按钮 - 绿色 */
.theme-green .vjs-big-play-button {
  background-color: rgba(0, 208, 132, 0.7); /* 半透明绿色 */
  border: 0.06666em solid rgba(0, 208, 132, 0.8);
  border-radius: 50%;
  width: 2em; /* 调整大播放按钮尺寸 */
  height: 2em;
  line-height: 2em;
  font-size: 3em; /* 调整图标大小 */
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
  background-color: rgba(101, 255, 124, 0.1); /* 半透明菜单背景 */
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
  display: none; /* 隐藏文本，只显示图标中的清晰度 */
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

/* 响应式 */
@media (max-width: 768px) {
  .theme-green .vjs-control-bar {
    font-size: 12px; /* 移动端更小的字体 */
  }
  
  .vjs-quality-menu-button .vjs-icon-placeholder::before {
    font-size: 1.3em;
  }
  
  .vjs-quality-menu-button .vjs-menu-button-text {
    display: none;
  }
}
</style>
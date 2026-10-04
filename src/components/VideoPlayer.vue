<template>
  <div class="video-player-container" tabindex="0" @keydown="handleKeydown" @click.capture="captureIntent">
    <video-player
      :poster="poster" :cross-origin="playback ? 'use-credentials' : undefined" :controls="true" :playback-rates="[0.5, 0.75, 1, 1.25, 1.5, 2]"
      :fluid="true" :aspect-ratio="aspectRatio" :picture-in-picture="true"
      :html5="{ vhs: { withCredentials: true } }"
      class="video-js vjs-big-play-centered theme-archive"
      @mounted="handleMounted" @ready="handleReady"
    />
    <p v-if="feedback" class="quality-feedback" role="status" aria-live="polite">{{ feedback }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef, watch, onBeforeUnmount } from 'vue'
import { VideoPlayer } from '@videojs-player/vue'
import videojs from 'video.js'
import type Player from 'video.js/dist/types/player'
import type Component from 'video.js/dist/types/component'
import type MenuButtonType from 'video.js/dist/types/menu/menu-button'
import type MenuItemType from 'video.js/dist/types/menu/menu-item'
import type { VideoSource } from '../types/video'
import type { VideoPlayback } from '../types/media'
import { qualityChoices, variantFor, legacyQuality, defaultLegacy, type QualityKey } from '../utils/mediaQuality'
import 'video.js/dist/video-js.css'

type Representation = { id: string; width: number; height: number; enabled(value?: boolean): boolean }
type Vhs = { representations(): Representation[] }
type GalleryPlayer = Player & { controlBar: Component }
type QualityButton = Component & { update(): void; updateButtonText(): void; items: Array<MenuItemType & { key: QualityKey }> }
const props = withDefaults(defineProps<{ poster?: string; videoSources?: VideoSource[]; playback?: VideoPlayback }>(), { poster: '', videoSources: () => [] })
const emit = defineEmits<{ playing: []; pause: []; qualitySwitchError: [message: string] }>()
const player = shallowRef<GalleryPlayer | null>(null)
const selection = ref<QualityKey>('auto')
const actual = ref('')
const switching = ref(false)
const feedback = ref('')
const unsupported = ref(new Set<string>())
const aspectRatio = computed(() => {
  const source = variantFor(props.playback, 'source') || props.playback?.variants.find(v => v.available)
  // Keep tall videos visible without taking several screen heights.
  return source?.width && source.height ? `${Math.round(Math.max(source.width / source.height, 0.7) * 1000)}:1000` : '16:9'
})
let qualityButton: QualityButton | undefined
let cleanupSwitch: (() => void) | undefined
let cleanupEvents: (() => void) | undefined
let sourceSnapshot: { time: number; rate: number; started: boolean } | undefined
let desiredPaused = true
let lastSuccessful: QualityKey = 'auto'
let recoveringSwitch = false
let generation = 0
let streamKey = ''
let timeout: ReturnType<typeof setTimeout> | undefined
const currentLabel = computed(() => {
  const label = qualityChoices.find(q => q.key === selection.value)?.label || '自动'
  return `${label}${selection.value === 'auto' && actual.value ? ` · ${actual.value}` : ''}${switching.value ? '…' : ''}`
})
function vhs(): Vhs | undefined {
  return (player.value?.tech(true) as unknown as { vhs?: Vhs })?.vhs
}
function unavailable(key: QualityKey): string {
  if (key === 'auto') return props.playback ? '' : '完成 HLS 升级后可自动选择'
  if (!props.playback) return props.videoSources.some(s => legacyQuality(s) === key) ? '' : '此档暂不可用'
  const variant = variantFor(props.playback, key)
  if (!variant?.available) return variant?.reason || '源分辨率不足或尚未生成'
  if (unsupported.value.has(variant.id)) return '当前设备无法解码'
  return ''
}
function updateMenu(rebuild = false) {
  if (rebuild) qualityButton?.update()
  qualityButton?.updateButtonText()
}
function clearPending() {
  cleanupSwitch?.()
  cleanupSwitch = undefined
  clearTimeout(timeout)
}
function finishSwitch() {
  clearPending()
  sourceSnapshot = undefined
  switching.value = false
  lastSuccessful = selection.value
  updateMenu()
}
function showError(message: string) {
  feedback.value = message
  emit('qualitySwitchError', message)
}
function reportActual() {
  const instance = player.value
  if (!instance) return
  const width = instance.videoWidth(), height = instance.videoHeight()
  const variant = props.playback?.variants.find(v => v.available && v.width === width && v.height === height)
  actual.value = variant?.label || (height ? `${Math.min(width, height)}p` : '')
  const target = variantFor(props.playback, selection.value)
  if (switching.value && !sourceSnapshot && (selection.value === 'auto' || (target?.width === width && target.height === height))) finishSwitch()
  updateMenu()
}
function applyRepresentations(): boolean {
  const handler = vhs()
  const representations = typeof handler?.representations === 'function' ? handler.representations() : []
  if (!representations.length || !props.playback) return false
  const target = selection.value === 'auto' ? undefined : variantFor(props.playback, selection.value)
  const allowed = representations.filter(rep => {
    const supported = props.playback!.variants.some(v => v.available && !unsupported.value.has(v.id) && v.width === rep.width && v.height === rep.height)
    return supported && (!target || (target.width === rep.width && target.height === rep.height))
  })
  if (!allowed.length) return false
  // Enable the destination before disabling others; VHS always has an eligible rendition.
  allowed.forEach(rep => rep.enabled(true))
  representations.filter(rep => !allowed.includes(rep)).forEach(rep => rep.enabled(false))
  return true
}
function armTimeout() {
  clearTimeout(timeout)
  if (!switching.value || desiredPaused) return
  timeout = setTimeout(() => {
    if (!switching.value) return
    if (recoveringSwitch) {
      clearPending(); sourceSnapshot = undefined; switching.value = false
      showError('视频加载超时，请检查连接后重新打开。'); updateMenu(); return
    }
    const fallback = props.playback ? 'auto' : lastSuccessful
    showError('清晰度切换超时，已恢复可用档位。')
    selectQuality(fallback, true)
  }, 45000)
}
function selectQuality(key: QualityKey, recovering = false) {
  const instance = player.value
  if (!instance || instance.isDisposed() || unavailable(key) || (!recovering && key === selection.value)) return
  clearPending()
  generation++
  if (!recovering) feedback.value = ''
  selection.value = key
  recoveringSwitch = recovering
  switching.value = true
  updateMenu()
  if (props.playback && vhs() && !instance.error()) {
    applyRepresentations()
    reportActual()
    armTimeout()
    return
  }
  // Safari native HLS receives a single-variant master including shared audio.
  const source = props.playback
    ? { src: key === 'auto' ? props.playback.masterUrl : variantFor(props.playback, key)?.url, type: 'application/x-mpegURL' }
    : props.videoSources.find(s => legacyQuality(s) === key)
  if (!source?.src) { switching.value = false; showError('此清晰度暂不可用。'); return }
  if (instance.currentSrc() === source.src && !sourceSnapshot) { finishSwitch(); return }
  sourceSnapshot ||= { time: instance.currentTime() || 0, rate: instance.playbackRate() || 1, started: instance.hasClass('vjs-has-started') }
  const saved = sourceSnapshot
  const token = generation
  const current = () => token === generation && !instance.isDisposed()
  const onMetadata = () => {
    if (!current()) return
    const duration = instance.duration()
    instance.currentTime(Number.isFinite(duration) ? Math.min(saved.time, Math.max(0, (duration || 0) - 0.05)) : saved.time)
    instance.playbackRate(saved.rate)
    instance.hasStarted(saved.started)
  }
  const onPlayable = () => {
    if (!current() || instance.seeking() || Math.abs((instance.currentTime() || 0) - saved.time) > 1) return
    finishSwitch()
    if (desiredPaused) instance.pause()
    else instance.play()?.catch(error => {
      if (error.name !== 'AbortError') showError('浏览器暂停了自动恢复播放，请点击播放。')
    })
  }
  const onError = () => {
    if (!current()) return
    clearPending()
    switching.value = false
    showError(recovering ? '视频加载失败，请检查连接后重新打开。' : '该档加载失败，正在恢复可用档位。')
    if (!recovering) selectQuality(props.playback ? 'auto' : lastSuccessful, true)
    else sourceSnapshot = undefined
  }
  instance.on('loadedmetadata', onMetadata)
  instance.on('canplay', onPlayable)
  instance.on('seeked', onPlayable)
  instance.on('error', onError)
  cleanupSwitch = () => {
    instance.off('loadedmetadata', onMetadata); instance.off('canplay', onPlayable)
    instance.off('seeked', onPlayable); instance.off('error', onError)
  }
  instance.src({ src: source.src, type: source.type })
  instance.load()
  armTimeout()
}
function syncSource() {
  const instance = player.value
  if (!instance || !cleanupEvents) return
  const nextKey = props.playback?.masterUrl || props.videoSources.map(s => s.src).join('|')
  if (streamKey === nextKey) return
  streamKey = nextKey
  clearPending(); generation++; sourceSnapshot = undefined; switching.value = false
  desiredPaused = true; feedback.value = ''; actual.value = ''; unsupported.value = new Set()
  selection.value = props.playback ? 'auto' : defaultLegacy(props.videoSources) as QualityKey
  lastSuccessful = selection.value
  updateMenu(true)
  const source = props.playback ? { src: props.playback.masterUrl, type: 'application/x-mpegURL' }
    : props.videoSources.find(s => legacyQuality(s) === selection.value)
  if (source?.src) { instance.src(source); instance.load() }
  void probeSupport()
}
async function probeSupport() {
  const playback = props.playback
  if (!playback || !navigator.mediaCapabilities?.decodingInfo) return
  const rejected = new Set<string>()
  await Promise.all(playback.variants.filter(v => v.available && v.codecs).map(async v => {
    try {
      const result = await navigator.mediaCapabilities.decodingInfo({
        type: vhs() ? 'media-source' : 'file', video: { contentType: `video/mp4; codecs="${v.codecs!.split(',')[0]}"`, width: v.width, height: v.height,
          bitrate: v.averageBandwidth || v.bandwidth || Math.max(1000000, v.width * v.height * 4), framerate: v.frameRate || 30 }
      })
      if (!result.supported) rejected.add(v.id)
    } catch { /* Unknown codecs stay available; normal player error handling remains active. */ }
  }))
  if (props.playback !== playback) return
  unsupported.value = rejected
  if (selection.value !== 'auto' && unavailable(selection.value)) {
    showError('当前设备无法解码该清晰度，已切回自动。')
    selectQuality('auto', true)
  } else applyRepresentations()
  updateMenu(true)
}
function createQualityButton(instance: GalleryPlayer) {
  const MenuButton = videojs.getComponent('MenuButton') as unknown as typeof MenuButtonType
  const MenuItem = videojs.getComponent('MenuItem') as typeof MenuItemType
  class QualityItem extends MenuItem {
    key: QualityKey
    constructor(p: Player, choice: typeof qualityChoices[number]) {
      const reason = unavailable(choice.key)
      super(p, { label: choice.label, selectable: true })
      this.key = choice.key
      this.selected(this.key === selection.value)
      this.el().setAttribute('aria-disabled', String(!!reason))
      this.el().setAttribute('title', reason || '')
      if (reason) this.addClass('quality-unavailable')
    }
    handleClick() { if (!unavailable(this.key)) selectQuality(this.key) }
  }
  class QualityMenu extends MenuButton {
    buildWrapperCSSClass() { return `vjs-quality-menu-button ${super.buildWrapperCSSClass()}` }
    createItems() { return qualityChoices.map(choice => new QualityItem(this.player(), choice)) }
    updateButtonText() {
      ;(this as unknown as QualityButton).items?.forEach(item => item.selected(item.key === selection.value))
      this.el().querySelector('.vjs-icon-placeholder')?.setAttribute('data-quality', currentLabel.value)
      this.controlText(`清晰度：${currentLabel.value}`)
    }
  }
  qualityButton = instance.controlBar.addChild(new QualityMenu(instance, {}) as unknown as Component, {}, instance.controlBar.children().length - 1) as QualityButton
}
function captureIntent(event: MouseEvent) {
  if ((event.target as HTMLElement).closest('.vjs-play-control, .vjs-big-play-button')) {
    desiredPaused = sourceSnapshot ? !desiredPaused : !player.value?.paused()
    if (desiredPaused) clearTimeout(timeout)
    else armTimeout()
  }
}
function handleKeydown(event: KeyboardEvent) {
  const instance = player.value
  if (!instance || (event.target as HTMLElement).closest('input, textarea, select, button, [role="menuitemradio"]')) return
  if (event.code === 'Space') {
    event.preventDefault(); desiredPaused = !desiredPaused
    if (desiredPaused) instance.pause(); else void instance.play()
  } else if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') {
    event.preventDefault(); instance.currentTime(Math.max(0, (instance.currentTime() || 0) + (event.code === 'ArrowLeft' ? -3 : 3)))
  }
}
function handleMounted({ player: instance }: { player: Player }) { player.value = instance as GalleryPlayer }
function handleReady() {
  const instance = player.value
  if (!instance || cleanupEvents) return
  const onPlay = () => { if (!sourceSnapshot) desiredPaused = false; armTimeout(); emit('playing') }
  const onPause = () => { if (!sourceSnapshot) desiredPaused = true; clearTimeout(timeout); emit('pause') }
  const onRepresentations = () => { applyRepresentations(); reportActual() }
  const onError = () => {
    if (!sourceSnapshot && props.playback && selection.value !== 'auto') {
      showError('当前清晰度播放失败，已切回自动。'); selectQuality('auto', true)
    }
  }
  instance.on('play', onPlay); instance.on('pause', onPause)
  instance.on('loadedmetadata', onRepresentations); instance.on('loadedplaylist', onRepresentations)
  instance.on('timeupdate', reportActual); instance.on('resize', reportActual); instance.on('error', onError)
  cleanupEvents = () => {
    instance.off('play', onPlay); instance.off('pause', onPause)
    instance.off('loadedmetadata', onRepresentations); instance.off('loadedplaylist', onRepresentations)
    instance.off('timeupdate', reportActual); instance.off('resize', reportActual); instance.off('error', onError)
  }
  createQualityButton(instance); syncSource()
}
watch(() => [props.playback, props.videoSources], syncSource, { deep: true, flush: 'post' })
onBeforeUnmount(() => {
  generation++; clearPending(); cleanupEvents?.(); qualityButton = undefined
  if (player.value && !player.value.isDisposed()) player.value.dispose()
})
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

/* Preserve media aspect ratio, with contain for tall videos. */
.video-player-container .video-js {
  background: #000;
}
.video-player-container .video-js .vjs-tech,
.video-player-container .video-js video {
  object-fit: contain;
  background: #000;
}

/* Albireo：金色播放入口，蓝色播放进度。 */
.theme-archive {
  --theme-accent: var(--star-blue);
  --theme-accent-dark: var(--star-blue-strong);
  --theme-accent-light: var(--text);
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

/* 主播放入口 */
.theme-archive .vjs-big-play-button {
  background-color: var(--star-gold);
  color: var(--accent-ink);
  border: 0.06666em solid var(--star-gold-bright);
  border-radius: 50%;
  width: 2em;
  height: 2em;
  line-height: 2em;
  font-size: 3em;
  transition: all 0.3s;
}

.theme-archive:hover .vjs-big-play-button,
.theme-archive .vjs-big-play-button:focus,
.theme-archive .vjs-big-play-button:hover {
  background-color: var(--star-gold-bright);
  border-color: var(--star-gold-bright);
  transform: scale(1.1);
}

/* 进度条 */
.theme-archive .vjs-progress-holder {
  height: 0.5em;
}

.theme-archive .vjs-play-progress {
  background-color: var(--star-blue);
}

.theme-archive .vjs-play-progress:before {
  color: var(--star-blue);
  font-size: 1.2em;
  text-shadow: none;
}

.theme-archive .vjs-load-progress {
  background: var(--star-blue-soft);
}

/* 音量条 */
.theme-archive .vjs-volume-level {
  background-color: var(--star-blue);
}

.theme-archive .vjs-volume-level:before {
  color: var(--star-blue);
}

/* 按钮悬停效果 */
.theme-archive .vjs-control:hover {
  color: var(--star-blue);
  text-shadow: none;
}
.theme-archive .vjs-control:focus-visible,
.theme-archive .vjs-big-play-button:focus-visible {
  outline: 2px solid var(--star-blue);
  outline-offset: 3px;
}

/* 菜单背景半透明 */
.theme-archive .vjs-menu .vjs-menu-content {
  background-color: var(--surface);
  border: 1px solid var(--line);
}

/* 菜单项选中状态 */
.theme-archive .vjs-menu li.vjs-selected,
.theme-archive .vjs-menu li.vjs-selected:focus,
.theme-archive .vjs-menu li.vjs-selected:hover {
  background-color: var(--star-gold-soft);
  color: var(--star-gold);
}

/* 菜单项悬停 */
.theme-archive .vjs-menu li:hover {
  background-color: var(--star-blue-soft);
  color: var(--star-blue);
}

/* 时间提示 */
.theme-archive .vjs-time-tooltip,
.theme-archive .vjs-mouse-display .vjs-time-tooltip {
  background-color: var(--star-blue);
  color: var(--accent-ink);
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
  background-color: var(--star-gold-soft);
  color: var(--star-gold);
}

.vjs-quality-menu-button .vjs-menu .vjs-menu-item.vjs-selected::before {
  content: '✓ ';
  color: var(--star-gold);
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
.quality-feedback { padding: 8px 12px; margin: 0; color: var(--star-gold); font-size: 13px; background: #151515; }
.theme-archive .vjs-quality-menu-button { width: 8em; }
.quality-unavailable { opacity: .4; cursor: not-allowed !important; }
@media (max-width: 600px) {
  .theme-archive .vjs-volume-panel,
  .theme-archive .vjs-picture-in-picture-control,
  .theme-archive .vjs-remaining-time { display: none !important; }
  .theme-archive .vjs-control { width: 3em; }
  .theme-archive .vjs-current-time,
  .theme-archive .vjs-duration { width: 2.8em; min-width: 2.8em; padding: 0 .25em; }
  .theme-archive .vjs-time-divider { width: .7em; min-width: .7em; padding: 0; }
  .theme-archive .vjs-quality-menu-button { width: 7em; }
  .theme-archive .vjs-quality-menu-button .vjs-icon-placeholder::before { font-size: 1em; }
}
</style>

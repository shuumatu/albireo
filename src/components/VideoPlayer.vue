<template>
  <div class="video-player-container" tabindex="0" @keydown="handleKeydown" @click.capture="captureIntent">
    <p v-if="authorizationError" role="alert">{{ authorizationError }} <button @click="authorizePlayback">重试</button></p>
    <p v-else-if="authorizing" role="status">正在准备播放…</p>
    <video-player v-else
      :poster="poster" :cross-origin="resolvedPlayback ? 'use-credentials' : undefined" :controls="true" :playback-rates="[0.5, 0.75, 1, 1.25, 1.5, 2]"
      :fluid="true" :aspect-ratio="aspectRatio" :picture-in-picture="true"
      :html5="playerHtml5"
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
import { browserBandwidthMemory, cappedPixelRatio, connectionInfo, DEFAULT_STARTUP_BANDWIDTH, mediaOrigin, networkFingerprint } from '../utils/playbackBandwidth'
import { createQualityPolicy, type VhsHandler } from '../utils/vhsQualityPolicy'
import { createPlaybackDiagnostics } from '../utils/playbackDiagnostics'
import 'video.js/dist/video-js.css'

type GalleryPlayer = Player & { controlBar: Component }
type QualityButton = Component & { update(): void; updateButtonText(): void; items: Array<MenuItemType & { key: QualityKey }> }
const props = withDefaults(defineProps<{ poster?: string; videoSources?: VideoSource[]; playback?: VideoPlayback }>(), { poster: '', videoSources: () => [] })
const emit = defineEmits<{ playing: []; pause: []; qualitySwitchError: [message: string] }>()
const resolvedPlayback = shallowRef<VideoPlayback | undefined>()
const authorizing = ref(false), authorizationError = ref('')
let authorization: AbortController | undefined
async function authorizePlayback() {
  authorization?.abort()
  const controller = new AbortController(); authorization = controller
  authorizationError.value = ''
  if (!props.playback?.authorizeUrl) { resolvedPlayback.value = props.playback; authorizing.value = false; return }
  authorizing.value = true; resolvedPlayback.value = undefined
  try {
    const response = await fetch(props.playback.authorizeUrl, { method: 'POST', credentials: 'include', signal: controller.signal })
    if (!response.ok) throw new Error('播放授权失败，请重试；分享过期时请刷新页面。')
    const playback: VideoPlayback = await response.json()
    if (!controller.signal.aborted) resolvedPlayback.value = playback
  } catch (error) {
    if (!controller.signal.aborted) authorizationError.value = error instanceof Error ? error.message : '播放加载失败'
  } finally { if (!controller.signal.aborted) authorizing.value = false }
}
onBeforeUnmount(() => authorization?.abort())
const player = shallowRef<GalleryPlayer | null>(null)
const selection = ref<QualityKey>('auto')
const actual = ref('')
const switching = ref(false)
const feedback = ref('')
const unsupported = ref(new Set<string>())
const playerHtml5 = { vhs: {
  withCredentials: true,
  useNetworkInformationApi: false,
  useBandwidthFromLocalStorage: false,
  limitRenditionByPlayerDimensions: true,
  useDevicePixelRatio: true,
  usePlayerObjectFit: true,
  customPixelRatio: cappedPixelRatio(window.devicePixelRatio)
} }
const bandwidthMemory = browserBandwidthMemory()
const qualityPolicy = createQualityPolicy()
let diagnostics: ReturnType<typeof createPlaybackDiagnostics>
let lastRecordedBytes = 0
let skipNextMeasurement = false
let activeOrigin: string | undefined
let network = networkFingerprint()
let frameRequest: number | undefined
let frameVideo: HTMLVideoElement | undefined
const aspectRatio = computed(() => {
  const source = variantFor(resolvedPlayback.value, 'source') || resolvedPlayback.value?.variants.find(v => v.available)
  // Give tall videos some room around the picture and controls.
  return source?.width && source.height ? `${Math.round(Math.max(source.width / source.height, 0.7) * 1000)}:1000` : '16:9'
})
const fluidPadding = computed(() => {
  const [width, height] = aspectRatio.value.split(':').map(Number)
  return `${height! / width! * 100}%`
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
function vhs(): VhsHandler | undefined {
  return (player.value?.tech(true) as unknown as { vhs?: VhsHandler })?.vhs
}
function bufferedAhead() {
  const instance = player.value
  if (!instance) return 0
  const time = instance.currentTime() || 0, ranges = instance.buffered()
  for (let i = 0; i < ranges.length; i++) if (ranges.start(i) <= time && ranges.end(i) >= time) return Math.max(0, ranges.end(i) - time)
  return 0
}
function diagnose(event: string) {
  const instance = player.value
  if (!diagnostics || !instance) return
  const handler = vhs()
  diagnostics.sample({ event, time: instance.currentTime() || 0, bufferedSeconds: Math.round(bufferedAhead() * 10) / 10,
    bandwidth: handler?.bandwidth, systemBandwidth: handler?.systemBandwidth,
    width: instance.videoWidth(), height: instance.videoHeight(), selection: selection.value,
    pixelRatio: handler?.customPixelRatio || cappedPixelRatio(window.devicePixelRatio) })
}
function rememberBandwidth() {
  const handler = vhs(), bytes = handler?.stats?.mediaBytesTransferred || 0
  if (!handler || !navigator.onLine) return
  // VHS uses a tiny synthetic estimate after a timeout; do not retain a fast seed.
  if (handler.bandwidth < 64_000) { bandwidthMemory.reset(); diagnose('bandwidth-timeout'); return }
  if (bytes <= lastRecordedBytes) return
  lastRecordedBytes = bytes
  if (skipNextMeasurement) { skipNextMeasurement = false; return }
  if (handler.bandwidth >= 64_000) bandwidthMemory.record(activeOrigin, network, handler.bandwidth)
  else bandwidthMemory.reset()
  diagnose('bandwidth')
}
function resetNetwork(event: Event) {
  bandwidthMemory.reset()
  const nextNetwork = networkFingerprint()
  const resetEstimate = nextNetwork !== network || event.type === 'online' || event.type === 'offline'
  network = nextNetwork
  skipNextMeasurement = true // An in-flight old-network segment is not a new measurement.
  const handler = vhs()
  if (handler) {
    lastRecordedBytes = handler.stats?.mediaBytesTransferred || 0
    // downlink/rtt updates also emit change: invalidate startup memory without
    // replacing a valid live segment measurement with a coarse network estimate.
    if (resetEstimate) {
      handler.bandwidth = DEFAULT_STARTUP_BANDWIDTH
      if (selection.value === 'auto') qualityPolicy.reselect(handler)
    }
  }
  diagnose(resetEstimate ? 'network-reset' : 'network-memory-reset')
}
function updatePixelRatio() {
  const handler = vhs(), ratio = cappedPixelRatio(window.devicePixelRatio)
  if (handler && handler.customPixelRatio !== ratio) {
    handler.customPixelRatio = ratio
    if (selection.value === 'auto') qualityPolicy.reselect(handler)
    diagnose('pixel-ratio')
  }
}
function unavailable(key: QualityKey): string {
  if (key === 'auto') return resolvedPlayback.value ? '' : '完成 HLS 升级后可自动选择'
  if (!resolvedPlayback.value) return props.videoSources.some(s => legacyQuality(s) === key) ? '' : '此档暂不可用'
  const variant = variantFor(resolvedPlayback.value, key)
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
  const variant = resolvedPlayback.value?.variants.find(v => v.available && v.width === width && v.height === height)
  actual.value = variant?.label || (height ? `${Math.min(width, height)}p` : '')
  const target = variantFor(resolvedPlayback.value, selection.value)
  if (switching.value && !sourceSnapshot && (selection.value === 'auto' || (target?.width === width && target.height === height))) finishSwitch()
  updateMenu()
}
function applyRepresentations(): boolean {
  const handler = vhs()
  if (!handler || !resolvedPlayback.value) return false
  const target = selection.value === 'auto' ? undefined : variantFor(resolvedPlayback.value, selection.value)
  return qualityPolicy.apply(handler, selection.value, rep => {
    const supported = resolvedPlayback.value!.variants.some(v => v.available && !unsupported.value.has(v.id) && v.width === rep.width && v.height === rep.height)
    return supported && (!target || (target.width === rep.width && target.height === rep.height))
  })
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
    const fallback = resolvedPlayback.value ? 'auto' : lastSuccessful
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
  diagnose('quality-selection')
  recoveringSwitch = recovering
  switching.value = true
  updateMenu()
  if (resolvedPlayback.value && vhs() && !instance.error()) {
    applyRepresentations()
    reportActual()
    armTimeout()
    return
  }
  // Safari native HLS receives a single-variant master including shared audio.
  const source = resolvedPlayback.value
    ? { src: key === 'auto' ? resolvedPlayback.value.masterUrl : variantFor(resolvedPlayback.value, key)?.url, type: 'application/x-mpegURL' }
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
    if (!recovering) selectQuality(resolvedPlayback.value ? 'auto' : lastSuccessful, true)
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
  if (!instance || instance.isDisposed() || !cleanupEvents) return
  const nextKey = resolvedPlayback.value?.masterUrl || props.videoSources.map(s => s.src).join('|')
  if (streamKey === nextKey) return
  streamKey = nextKey
  qualityPolicy.reset()
  diagnostics?.endWait()
  diagnostics = createPlaybackDiagnostics()
  activeOrigin = resolvedPlayback.value ? mediaOrigin(resolvedPlayback.value.masterUrl, location.href) : undefined
  lastRecordedBytes = 0
  network = networkFingerprint()
  skipNextMeasurement = false
  if (frameRequest !== undefined) frameVideo?.cancelVideoFrameCallback(frameRequest)
  frameRequest = undefined; frameVideo = undefined
  clearPending(); generation++; sourceSnapshot = undefined; switching.value = false
  desiredPaused = true; feedback.value = ''; actual.value = ''; unsupported.value = new Set()
  selection.value = resolvedPlayback.value ? 'auto' : defaultLegacy(props.videoSources) as QualityKey
  lastSuccessful = selection.value
  updateMenu(true)
  const source = resolvedPlayback.value ? { src: resolvedPlayback.value.masterUrl, type: 'application/x-mpegURL',
    bandwidth: bandwidthMemory.read(activeOrigin, network) || DEFAULT_STARTUP_BANDWIDTH,
    customPixelRatio: cappedPixelRatio(window.devicePixelRatio) }
    : props.videoSources.find(s => legacyQuality(s) === selection.value)
  if (source?.src) { instance.src(source); instance.load() }
  diagnose('source')
  void probeSupport()
}
async function probeSupport() {
  const playback = resolvedPlayback.value
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
  if (resolvedPlayback.value !== playback) return
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
function handleMounted({ player: instance }: { player: Player }) {
  clearPending(); cleanupEvents?.(); cleanupEvents = undefined
  if (frameRequest !== undefined) frameVideo?.cancelVideoFrameCallback(frameRequest)
  frameRequest = undefined; frameVideo = undefined; qualityButton = undefined
  streamKey = ''; generation++; player.value = instance as GalleryPlayer
}
function handleReady() {
  const instance = player.value
  if (!instance || cleanupEvents) return
  const onPlay = () => { if (!sourceSnapshot) desiredPaused = false; diagnostics?.play(); armTimeout(); emit('playing') }
  const onPause = () => { if (!sourceSnapshot) desiredPaused = true; diagnostics?.endWait(); clearTimeout(timeout); emit('pause') }
  const onPlaying = () => {
    diagnostics?.endWait()
    const video = instance.el().querySelector('video')
    if (diagnostics && video && typeof video.requestVideoFrameCallback === 'function') {
      if (frameRequest !== undefined) frameVideo?.cancelVideoFrameCallback(frameRequest)
      frameVideo = video
      frameRequest = video.requestVideoFrameCallback(() => { frameRequest = undefined; diagnostics?.firstFrame(); diagnose('playing-frame') })
    } else { diagnostics?.firstFrame(); diagnose('playing') }
  }
  const onWaiting = () => { if (!instance.paused() && !instance.seeking() && !instance.ended()) { diagnostics?.waiting(); diagnose('waiting') } }
  const onSeeking = () => diagnostics?.endWait()
  const onRepresentations = () => { applyRepresentations(); reportActual() }
  const onResize = () => { reportActual(); diagnose('rendition') }
  const onError = () => {
    if (!sourceSnapshot && resolvedPlayback.value && selection.value !== 'auto') {
      showError('当前清晰度播放失败，已切回自动。'); selectQuality('auto', true)
    }
  }
  instance.on('play', onPlay); instance.on('pause', onPause)
  instance.on('playing', onPlaying); instance.on('waiting', onWaiting); instance.on('seeking', onSeeking)
  // VHS emits this custom event on Tech; Video.js does not forward it to Player.
  const tech = instance.tech(true)
  tech.on('bandwidthupdate', rememberBandwidth)
  instance.on('loadedmetadata', onRepresentations); instance.on('loadedplaylist', onRepresentations)
  instance.on('timeupdate', reportActual); instance.on('resize', onResize); instance.on('error', onError)
  const connection = connectionInfo()
  connection?.addEventListener('change', resetNetwork)
  window.addEventListener('online', resetNetwork); window.addEventListener('offline', resetNetwork)
  window.addEventListener('resize', updatePixelRatio)
  cleanupEvents = () => {
    instance.off('play', onPlay); instance.off('pause', onPause)
    instance.off('loadedmetadata', onRepresentations); instance.off('loadedplaylist', onRepresentations)
    instance.off('timeupdate', reportActual); instance.off('resize', onResize); instance.off('error', onError)
    instance.off('playing', onPlaying); instance.off('waiting', onWaiting); instance.off('seeking', onSeeking)
    tech.off('bandwidthupdate', rememberBandwidth)
    connection?.removeEventListener('change', resetNetwork)
    window.removeEventListener('online', resetNetwork); window.removeEventListener('offline', resetNetwork)
    window.removeEventListener('resize', updatePixelRatio)
  }
  createQualityButton(instance); syncSource()
}
watch(() => [resolvedPlayback.value, props.videoSources], syncSource, { deep: true, flush: 'post' })
onBeforeUnmount(() => {
  generation++; clearPending(); cleanupEvents?.(); qualityButton = undefined
  qualityPolicy.dispose(); diagnostics?.endWait()
  if (frameRequest !== undefined) frameVideo?.cancelVideoFrameCallback(frameRequest)
  if (player.value && !player.value.isDisposed()) player.value.dispose()
})
watch(() => props.playback, authorizePlayback, { immediate: true })
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
/* Fluid mode sizes the player with padding, so cap that instead of max-height. */
.video-player-container .video-js.vjs-fluid:not(.vjs-fullscreen) {
  padding-top: min(v-bind(fluidPadding), 70vh);
  padding-top: min(v-bind(fluidPadding), 70svh);
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
  --theme-accent-light: var(--on-photo);
}

/* 控制栏尺寸调整 */
.theme-archive .vjs-control-bar {
  height: 3.5em;
  font-size: 14px;
  color: var(--on-photo);
  background: linear-gradient(transparent, rgb(0 0 0 / 72%));
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
  background-color: var(--on-photo-blue);
}

.theme-archive .vjs-play-progress:before {
  color: var(--on-photo-blue);
  font-size: 1.2em;
  text-shadow: none;
}

.theme-archive .vjs-load-progress {
  background: var(--star-blue-soft);
}

/* 音量条 */
.theme-archive .vjs-volume-level {
  background-color: var(--on-photo-blue);
}

.theme-archive .vjs-volume-level:before {
  color: var(--on-photo-blue);
}

/* 按钮悬停效果 */
.theme-archive .vjs-control:hover {
  color: var(--on-photo-blue);
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
  color: var(--text);
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
.quality-feedback { padding: 8px 12px; margin: 0; color: var(--accent-warm); font-size: 13px; background: var(--surface); }
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

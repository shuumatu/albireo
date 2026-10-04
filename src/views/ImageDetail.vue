<script setup lang="ts">
import MediaImage from '../components/MediaImage.vue'

import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import dayjs from 'dayjs'
import { getImageInfo, type ImageInfoVO } from '../api/image'
import CommentSection from '../components/CommentSection.vue'
import SimilarStrip from '../components/SimilarStrip.vue'
import PhotoViewer from '../components/PhotoViewer.vue'
import { formatImageSize } from '../utils/photoViewer'
const route = useRoute(),
  router = useRouter(),
  uuid = String(route.params.uuid)
const image = ref<ImageInfoVO | null>(null),
  loading = ref(true),
  error = ref(false),
  imageError = ref(false),
  loaded = ref(false)
const viewer = ref<InstanceType<typeof PhotoViewer>>()
const stageButton = ref<HTMLButtonElement>()
const stageImageComponent = ref<InstanceType<typeof MediaImage>>()
const stageImage = computed(() => stageImageComponent.value?.image)
const viewerError = ref(false)
const sourceIndex = ref(0)
const imageAttempt = ref(0)
let loadId = 0
const sources = computed(() => [
  ...new Set(
    [
      image.value?.displayUrl,
      image.value?.mediumUrl,
      image.value?.imageUrl
    ].filter((url): url is string => Boolean(url))
  )
])
const src = computed(() => sources.value[sourceIndex.value] || '')
const fileSize = computed(() => formatImageSize(image.value?.fileSize))
const title = computed(() => image.value?.title || '未命名作品')
const date = (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm')
const status = computed(
  () =>
    ({
      uploading: '上传中',
      processing: '处理中',
      done: '已完成',
      failed: '失败'
    })[image.value?.status || ''] || image.value?.status
)
function back() {
  if (window.history.state?.back) router.back()
  else router.push('/timeline')
}
async function load() {
  const id = ++loadId
  loading.value = true
  error.value = false
  imageError.value = false
  loaded.value = false
  viewerError.value = false
  sourceIndex.value = 0
  imageAttempt.value++
  try {
    const result = await getImageInfo(uuid)
    if (id !== loadId) return
    image.value = result
    if (!result) error.value = true
  } catch {
    if (id === loadId) error.value = true
  } finally {
    if (id === loadId) loading.value = false
  }
}
function imageFailed() {
  if (sourceIndex.value + 1 < sources.value.length) sourceIndex.value++
  else imageError.value = true
}
function open() {
  if (
    !loaded.value ||
    imageError.value ||
    !stageButton.value ||
    !stageImage.value
  )
    return
  viewerError.value = false
  void viewer.value?.open(stageButton.value, stageImage.value)
}
onMounted(load)
onBeforeUnmount(() => {
  loadId++
})
</script>
<template>
  <article class="image-detail">
    <nav class="detail-nav">
      <button class="archive-action" @click="back">← 返回</button
      ><span class="archive-eyebrow">ALBIREO / PHOTOGRAPH</span>
    </nav>
    <div v-if="loading" class="archive-state" role="status">正在加载影像…</div>
    <div v-else-if="error" class="archive-state" role="alert">
      <h1>暂时无法打开这张作品</h1>
      <p>作品可能已移除，或当前连接不可用。</p>
      <button class="archive-action" @click="load">重新加载</button
      ><router-link to="/timeline" class="archive-action"
        >浏览时间线 ↗</router-link
      >
    </div>
    <template v-else-if="image">
      <div class="detail-grid">
        <figure class="photo-presentation">
          <div
            class="image-stage"
            :class="{ 'is-loaded': loaded && !imageError }"
            :aria-busy="!loaded && !imageError"
          >
            <button
              ref="stageButton"
              class="image-open"
              type="button"
              :disabled="!loaded || imageError || viewer?.opening"
              :aria-label="`详细浏览照片：${title}`"
              aria-haspopup="dialog"
              aria-describedby="photo-open-hint"
              @click="open"
            >
              <MediaImage :renditions="sourceIndex === 0 ? image.renditions : undefined" fit="contain" loading="eager"
                ref="stageImageComponent"
                :key="`${imageAttempt}-${src}`"
                :src="src"
                :alt="title"
                decoding="async"
                fetchpriority="high"
                draggable="false"
                @load="loaded = true"
                @error="imageFailed"
              />
            </button>
            <div v-if="imageError" class="image-state" role="alert">
              <p>图片暂时无法加载</p>
              <button class="archive-action" @click="load">重新加载</button>
            </div>
            <div v-else-if="!loaded" class="image-state" role="status">
              <span class="image-loading-mark" aria-hidden="true"></span
              >正在载入画面…
            </div>
          </div>
          <figcaption class="photo-caption">
            <span id="photo-open-hint">点击照片，进入沉浸浏览</span
            ><span v-if="image.width && image.height" class="photo-resolution"
              >{{ image.width }} × {{ image.height }}</span
            >
          </figcaption>
          <p v-if="viewerError" class="photo-viewer-error" role="alert">
            浏览器暂时无法打开，请点击照片重试。
          </p>
        </figure>
        <aside class="detail-meta hud-panel">
          <span class="archive-eyebrow">IMAGE ARCHIVE</span>
          <h1>{{ title }}</h1>
          <p v-if="image.description" class="description">
            {{ image.description }}
          </p>
          <dl>
            <template v-if="image.shotAt"
              ><dt>拍摄时间</dt>
              <dd>{{ date(image.shotAt) }}</dd></template
            ><template v-if="image.type"
              ><dt>作品类型</dt>
              <dd>{{ image.type }}</dd></template
            >
            <dt>收录时间</dt>
            <dd>{{ date(image.createdAt) }}</dd>
          </dl>
          <details class="file-details">
            <summary>文件信息</summary>
            <dl>
              <dt>文件名</dt>
              <dd>{{ image.fileName }}</dd>
              <template v-if="fileSize"
                ><dt>文件大小</dt>
                <dd>{{ fileSize }}</dd></template
              >
              <dt>处理状态</dt>
              <dd>{{ status }}</dd>
            </dl>
          </details>
          <span class="meta-footnote">LIGHT. PLACE. MEMORY.</span>
        </aside>
      </div>
      <div class="related"><SimilarStrip type="image" :uuid="uuid" /></div>
      <div class="comments hud-panel">
        <CommentSection target-type="image" :target-id="uuid" />
      </div>
      <PhotoViewer
        ref="viewer"
        :image="image"
        :title="title"
        @error="viewerError = true"
      />
    </template>
  </article>
</template>
<style scoped>
.image-detail {
  padding: 28px 5% 64px;
  max-width: 1640px;
  margin: auto;
}
.detail-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  gap: 16px;
}
.detail-nav .archive-eyebrow {
  margin: 0;
  font-size: 10px;
}
.detail-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 0;
  border: 1px solid var(--line);
}
.image-stage {
  position: relative;
  background: color-mix(in srgb, var(--bg) 60%, black);
  min-height: 480px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  overflow: hidden;
}
.photo-presentation {
  margin: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: color-mix(in srgb, var(--bg) 60%, black);
}
.photo-caption {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 14px 28px;
  color: var(--muted);
  font-size: 11px;
  border-top: 1px solid color-mix(in srgb, var(--line) 55%, transparent);
}
.photo-resolution {
  font: 10px var(--mono);
  letter-spacing: 0.5px;
}
.photo-viewer-error {
  font-size: 12px;
  color: var(--star-gold);
  padding: 0 28px;
}
.image-open {
  border: 0;
  padding: 28px;
  width: 100%;
  height: 100%;
  background: transparent;
  position: relative;
  color: var(--text);
  cursor: zoom-in;
  outline-offset: -4px;
}
.image-open :deep(img) {
  display: block;
  width: 100%;
  height: 100%;
  max-height: 72dvh;
  object-fit: contain;
  opacity: 0;
  transform: scale(0.99);
  transition:
    opacity 450ms ease,
    transform 600ms cubic-bezier(0.22, 1, 0.36, 1);
}
.is-loaded .image-open :deep(img) {
  opacity: 1;
  transform: scale(1);
}
.image-loading-mark {
  width: 30px;
  height: 30px;
  margin-bottom: 20px;
  border: 1px solid var(--line);
  border-top-color: var(--star-blue);
  border-radius: 50%;
  animation: photo-loading 1s linear infinite;
}
@keyframes photo-loading {
  to {
    transform: rotate(360deg);
  }
}
.image-state {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  background: color-mix(in srgb, var(--bg) 60%, black);
  color: var(--muted);
}
.detail-meta {
  padding: 40px 28px;
  border: 0;
  border-left: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.detail-meta h1 {
  font-size: 28px;
  line-height: 1.4;
  margin: 16px 0 20px;
  overflow-wrap: anywhere;
}
.detail-meta .archive-eyebrow {
  color: var(--star-gold);
}
.description {
  font-size: 14px;
  line-height: 1.9;
  color: var(--muted);
  white-space: pre-wrap;
}
dl {
  display: grid;
  grid-template-columns: 80px minmax(0, 1fr);
  gap: 18px 10px;
  padding: 24px 0;
  border-top: 1px solid var(--line);
  font-size: 12px;
}
dt {
  color: var(--muted);
}
dd {
  margin: 0;
  text-align: right;
  overflow-wrap: anywhere;
}
.file-details {
  border-top: 1px solid var(--line);
  font-size: 12px;
  color: var(--muted);
}
summary {
  padding: 14px 0;
  cursor: pointer;
  min-height: 44px;
}
.file-details dl {
  border: 0;
  padding: 8px 0;
}
.meta-footnote {
  font: 10px var(--mono);
  letter-spacing: 1px;
  color: var(--star-blue);
  margin-top: auto;
  padding-top: 32px;
}
.related {
  padding-top: 20px;
}
.comments {
  padding: 30px;
  margin-top: 24px;
}
@media (max-width: 850px) {
  .detail-grid {
    grid-template-columns: 1fr;
  }
  .detail-meta {
    border-left: 0;
    border-top: 1px solid var(--line);
  }
  .image-stage {
    min-height: 320px;
  }
  .image-open :deep(img) {
    max-height: 65dvh;
  }
}
@media (max-width: 600px) {
  .image-detail {
    padding: 20px 20px 40px;
  }
  .detail-meta {
    padding: 28px 20px;
  }
  .detail-nav .archive-eyebrow {
    font-size: 8px;
    letter-spacing: 0;
  }
  .image-open {
    padding: 12px;
  }
  .comments {
    padding: 20px;
  }
  .detail-meta h1 {
    font-size: 24px;
  }
  .photo-caption {
    padding: 12px 16px;
    font-size: 10px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .image-open :deep(img) {
    transition: none;
    transform: none;
  }
  .image-loading-mark {
    animation: none;
  }
}
</style>

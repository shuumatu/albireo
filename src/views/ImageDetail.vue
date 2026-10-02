<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import dayjs from 'dayjs'
import { getImageInfo, type ImageInfoVO } from '../api/image'
import CommentSection from '../components/CommentSection.vue'
import SimilarStrip from '../components/SimilarStrip.vue'
const route = useRoute(),
  router = useRouter(),
  uuid = String(route.params.uuid)
const image = ref<ImageInfoVO | null>(null),
  loading = ref(true),
  error = ref(false),
  imageError = ref(false),
  loaded = ref(false),
  zoom = ref(false)
const lightbox = ref<HTMLDialogElement>(),
  stageButton = ref<HTMLButtonElement>()
const src = computed(
  () => image.value?.displayUrl || image.value?.imageUrl || ''
)
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
  loading.value = true
  error.value = false
  imageError.value = false
  loaded.value = false
  try {
    image.value = await getImageInfo(uuid)
    if (!image.value) error.value = true
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
}
async function open() {
  if (!loaded.value || imageError.value) return
  zoom.value = false
  await nextTick()
  lightbox.value?.showModal()
  document.body.style.overflow = 'hidden'
}
function closed() {
  document.body.style.overflow = ''
  stageButton.value?.focus()
}
onMounted(load)
onBeforeUnmount(() => {
  document.body.style.overflow = ''
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
        <div class="image-stage">
          <button
            ref="stageButton"
            class="image-open"
            :disabled="!loaded || imageError"
            aria-label="全屏查看图片"
            @click="open"
          >
            <img
              :key="src"
              :src="src"
              :alt="title"
              @load="loaded = true"
              @error="imageError = true"
            /><span v-if="loaded && !imageError" class="expand-hint"
              >查看原图 ↗</span
            >
          </button>
          <div v-if="imageError" class="image-state" role="alert">
            <p>图片暂时无法加载</p>
            <button class="archive-action" @click="load">重新加载</button>
          </div>
          <div v-else-if="!loaded" class="image-state" role="status">
            正在载入画面…
          </div>
        </div>
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
    </template>
    <Teleport to="body"
      ><dialog
        ref="lightbox"
        class="image-lightbox"
        aria-label="图片全屏预览"
        @close="closed"
        @click="$event.target === lightbox && lightbox?.close()"
      >
        <div class="lightbox-toolbar">
          <span>{{ title }}</span>
          <div>
            <button
              class="archive-action"
              :aria-pressed="zoom"
              @click="zoom = !zoom"
            >
              {{ zoom ? '适应屏幕' : '放大画面' }}</button
            ><button
              class="archive-action"
              autofocus
              @click="lightbox?.close()"
              aria-label="关闭图片预览"
            >
              关闭 ×
            </button>
          </div>
        </div>
        <div class="lightbox-stage" :class="{ zoomed: zoom }">
          <img :src="src" :alt="title" />
        </div></dialog
    ></Teleport>
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
}
.image-open {
  border: 0;
  padding: 28px;
  width: 100%;
  height: 100%;
  background: transparent;
  position: relative;
  color: var(--text);
}
.image-open img {
  display: block;
  width: 100%;
  height: 100%;
  max-height: 72dvh;
  object-fit: contain;
}
.expand-hint {
  position: absolute;
  bottom: 20px;
  right: 20px;
  background: color-mix(in srgb, var(--surface) 94%, transparent);
  padding: 10px 16px;
  border: 1px solid var(--line);
  font-size: 12px;
  opacity: 0.7;
}
.image-open:is(:hover, :focus-visible) .expand-hint {
  opacity: 1;
  color: var(--accent);
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
.image-lightbox {
  width: 96vw;
  max-width: none;
  height: 94dvh;
  max-height: 94dvh;
  margin: auto;
  padding: 0;
  background: color-mix(in srgb, var(--bg) 60%, black);
  color: var(--text);
  border: 1px solid var(--line);
}
.image-lightbox::backdrop {
  background: color-mix(in srgb, var(--bg) 94%, transparent);
}
.lightbox-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  border-bottom: 1px solid var(--line);
  gap: 12px;
}
.lightbox-toolbar > span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lightbox-toolbar > div {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
.lightbox-stage {
  height: calc(100% - 69px);
  overflow: auto;
  display: grid;
  place-items: center;
  padding: 20px;
}
.lightbox-stage img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
.lightbox-stage.zoomed {
  display: block;
}
.lightbox-stage.zoomed img {
  width: 150%;
  max-width: none;
  max-height: none;
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
  .image-open img {
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
  .lightbox-toolbar {
    padding: 8px;
    flex-wrap: wrap;
  }
  .lightbox-toolbar > span {
    font-size: 12px;
  }
  .lightbox-toolbar .archive-action {
    padding: 8px 12px;
    font-size: 12px;
  }
}
</style>

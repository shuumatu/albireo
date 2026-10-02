<template>
  <div class="share-page">
    <!-- 顶栏 -->
    <header class="share-topbar">
      <router-link class="brand-name" to="/">ALBIREO ／</router-link>
      <n-text depth="3" class="topbar-tag">SHARED ARCHIVE</n-text>
    </header>

    <!-- 加载状态 -->
    <div v-if="loading" class="share-center">
      <n-spin size="large" />
      <n-text depth="3" style="margin-top: 16px">正在加载分享内容…</n-text>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="error" class="share-center">
      <n-card class="error-card" :bordered="false">
        <n-result status="error" :title="error" :description="errorDesc">
          <template #footer>
            <n-button @click="router.push('/')">返回首页</n-button>
          </template>
        </n-result>
      </n-card>
    </div>

    <!-- 需要密码 -->
    <div v-else-if="needPassword" class="share-center">
      <n-card class="password-card" :bordered="false">
        <div class="password-icon">
          <svg viewBox="0 0 24 24" width="48" height="48">
            <path
              d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6zm9 14H6V10h12v10zm-6-3c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"
              fill="currentColor"
            />
          </svg>
        </div>
        <h2 class="password-title">该分享需要密码访问</h2>
        <n-space vertical :size="14" style="margin-top: 18px">
          <p v-if="shareData?.title" class="share-title">
            {{ shareData.title }}
          </p>
          <p v-if="shareData?.description" class="share-desc">
            {{ shareData.description }}
          </p>
          <n-input
            v-model:value="passwordInput"
            type="password"
            placeholder="请输入访问密码"
            :input-props="{ 'aria-label': '访问密码' }"
            show-password-on="click"
            size="large"
            :status="passwordError ? 'error' : undefined"
            @update:value="passwordError = ''"
            @keyup.enter="submitPassword"
          />
          <p v-if="passwordError" class="password-error">{{ passwordError }}</p>
          <n-button
            type="primary"
            block
            size="large"
            :loading="submitting"
            @click="submitPassword"
          >
            确认访问
          </n-button>
        </n-space>
      </n-card>
    </div>

    <!-- 分享内容展示 -->
    <div v-else-if="shareData?.content" class="share-content-wrapper">
      <header class="share-header">
        <n-tag
          size="small"
          type="info"
          :bordered="false"
          style="margin-bottom: 12px"
        >
          {{ targetTypeLabel }}
        </n-tag>
        <h1 class="share-main-title">{{ shareData.title || defaultTitle }}</h1>
        <p v-if="shareData.description" class="share-main-desc">
          {{ shareData.description }}
        </p>
      </header>

      <main class="share-main">
        <VideoShareContent
          v-if="shareData.targetType === 'video'"
          :content="shareData.content"
        />
        <ImageShareContent
          v-else-if="shareData.targetType === 'image'"
          :content="shareData.content"
        />
        <CollectionShareContent
          v-else-if="shareData.targetType === 'collection'"
          :content="shareData.content"
        />
      </main>

      <footer class="share-footer">
        <n-text depth="3" style="font-size: 12px">
          通过 Albireo 分享链接查看 · 内容由分享者发布，请遵守相关法律法规
        </n-text>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  NSpin,
  NResult,
  NButton,
  NCard,
  NInput,
  NSpace,
  NTag,
  NText
} from 'naive-ui'
import { getShareMeta, accessShareWithPassword } from '../../api/share'
import type { ShareAccessVO } from '../../api/share'
import VideoShareContent from './components/VideoShareContent.vue'
import ImageShareContent from './components/ImageShareContent.vue'
import CollectionShareContent from './components/CollectionShareContent.vue'

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const error = ref<string | null>(null)
const errorDesc = ref('该分享链接可能已过期或不存在')
const needPassword = ref(false)
const shareData = ref<ShareAccessVO | null>(null)
const passwordInput = ref('')
const passwordError = ref('')
const submitting = ref(false)

const shareCode = route.params.shareCode as string

const targetTypeLabel = computed(() => {
  if (!shareData.value) return ''
  return shareData.value.targetType === 'video'
    ? '视频'
    : shareData.value.targetType === 'image'
      ? '图片'
      : '合集'
})


const defaultTitle = computed(() => {
  if (!shareData.value) return '分享内容'
  return `${targetTypeLabel.value}分享`
})

/**
 * 同步页面 title——分享链接被原样转发到聊天 / 微博等场景时，
 * 多数预览引擎会读 og:title / 退化到 document.title。
 */
function applyDocumentTitle() {
  const t = shareData.value?.title || defaultTitle.value
  document.title = `${t} - Albireo 分享`
}

watch(shareData, () => {
  applyDocumentTitle()
})

onMounted(async () => {
  try {
    const data = await getShareMeta(shareCode)
    shareData.value = data.needPassword
      ? data
      : await accessShareWithPassword(shareCode, '')
    needPassword.value = data.needPassword
    applyDocumentTitle()
  } catch (e: any) {
    const msg = e?.response?.data?.message || '获取分享内容失败'
    error.value = msg
    if (msg.includes('过期') || msg.includes('停用') || msg.includes('禁用')) {
      errorDesc.value = '请联系分享者获取新的链接'
    } else if (msg.includes('达到最大')) {
      errorDesc.value = '该分享访问已达上限'
    } else if (msg.includes('不存在')) {
      errorDesc.value = '分享链接可能已被删除或链接拼写有误'
    }
    document.title = '分享不可用 - Albireo'
  } finally {
    loading.value = false
  }
})

async function submitPassword() {
  if (!passwordInput.value) {
    passwordError.value = '请输入密码'
    return
  }
  submitting.value = true
  try {
    const data = await accessShareWithPassword(shareCode, passwordInput.value)
    shareData.value = data
    needPassword.value = false
    passwordError.value = ''
  } catch (e: any) {
    passwordError.value = e?.response?.data?.message || '密码错误，请重试'
    passwordInput.value = ''
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.share-page {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background: var(--bg);
}
.share-topbar {
  padding: 26px 6%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--line);
}
.brand-name {
  font: 700 20px var(--mono);
  letter-spacing: 3px;
  position: relative;
  padding-left: 34px;
}
.brand-name::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--star-gold);
  box-shadow: 14px -4px 0 -1px var(--star-blue);
  transform: translateY(-50%);
}
.topbar-tag {
  font: 10px var(--mono);
  letter-spacing: 2px;
  color: var(--star-blue);
}
.share-center {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 20px;
}
.error-card,
.password-card {
  max-width: 460px;
  border: 1px solid var(--line);
  border-radius: 0;
}
.password-card {
  text-align: center;
  padding: 20px 8px;
}
.password-icon {
  color: var(--star-gold);
  width: 72px;
  height: 72px;
  display: grid;
  place-items: center;
  margin: auto;
  border: 1px solid var(--line);
  background: var(--star-gold-soft);
}
.password-title {
  font-size: 20px;
  margin: 24px 0 0;
}
.share-title {
  font-size: 16px;
  margin: 0;
}
.share-desc,
.share-main-desc {
  color: var(--muted);
  line-height: 1.8;
}
.password-error {
  color: #ec969a;
  text-align: left;
  margin: 0;
}
.share-content-wrapper {
  width: 100%;
  max-width: 1200px;
  margin: auto;
  padding: 56px 32px;
}
.share-header {
  border-left: 3px solid var(--star-gold);
  padding-left: 24px;
  margin-bottom: 36px;
}
.share-main-title {
  font-size: clamp(26px, 4vw, 40px);
  letter-spacing: 2px;
  margin: 8px 0 16px;
  overflow-wrap: anywhere;
}
.share-main-desc {
  max-width: 720px;
}
.share-footer {
  margin-top: 48px;
  padding-top: 24px;
  border-top: 1px solid var(--line);
}
@media (max-width: 640px) {
  .share-topbar {
    padding: 22px 20px;
  }
  .brand-name {
    font-size: 16px;
  }
  .topbar-tag {
    font-size: 8px;
  }
  .share-content-wrapper {
    padding: 32px 20px;
  }
  .share-header {
    padding-left: 16px;
  }
  .share-main :deep(.n-card__content) {
    padding: 16px;
  }
}
</style>

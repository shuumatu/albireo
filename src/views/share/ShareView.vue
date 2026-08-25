<template>
  <div class="share-page">
    <!-- 顶栏 -->
    <header class="share-topbar">
      <span class="brand-name" @click="router.push('/')">Albireo</span>
      <n-text depth="3" class="topbar-tag">分享内容</n-text>
    </header>

    <!-- 加载状态 -->
    <div v-if="loading" class="share-center">
      <n-spin size="large" />
      <n-text depth="3" style="margin-top: 16px;">正在加载分享内容…</n-text>
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
        <n-space vertical :size="14" style="margin-top: 18px;">
          <p v-if="shareData?.title" class="share-title">{{ shareData.title }}</p>
          <p v-if="shareData?.description" class="share-desc">{{ shareData.description }}</p>
          <n-input
            v-model:value="passwordInput"
            type="password"
            placeholder="请输入访问密码"
            show-password-on="click"
            size="large"
            :status="passwordError ? 'error' : 'default'"
            @update:value="passwordError = ''"
            @keyup.enter="submitPassword"
          />
          <p v-if="passwordError" class="password-error">{{ passwordError }}</p>
          <n-button type="primary" block size="large" :loading="submitting" @click="submitPassword">
            确认访问
          </n-button>
        </n-space>
      </n-card>
    </div>

    <!-- 分享内容展示 -->
    <div v-else-if="shareData?.content" class="share-content-wrapper">
      <header class="share-header">
        <n-tag size="small" :type="targetTagType" :bordered="false" style="margin-bottom: 12px;">
          {{ targetTypeLabel }}
        </n-tag>
        <h1 class="share-main-title">{{ shareData.title || defaultTitle }}</h1>
        <p v-if="shareData.description" class="share-main-desc">{{ shareData.description }}</p>
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
        <n-text depth="3" style="font-size: 12px;">
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
  NSpin, NResult, NButton, NCard, NInput, NSpace, NTag, NText
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
  return shareData.value.targetType === 'video' ? '视频'
    : shareData.value.targetType === 'image' ? '图片'
    : '合集'
})

const targetTagType = computed<'info' | 'success' | 'warning'>(() => {
  if (!shareData.value) return 'info'
  return shareData.value.targetType === 'video' ? 'info'
    : shareData.value.targetType === 'image' ? 'success'
    : 'warning'
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
    shareData.value = data
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
/*
  全局 App.vue 把 html / body / #app 都设为 overflow:hidden + 100vh，
  这意味着 ShareView 自己必须建立一个可滚动的视口，否则合集分享子项一多就被裁掉。
  这里用 height:100% + overflow-y:auto 让分享页内部成为滚动容器。
*/
.share-page {
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  background:
    radial-gradient(ellipse at top, rgba(64, 158, 255, 0.08), transparent 60%),
    linear-gradient(180deg, #f8fafc 0%, #eef2f6 100%);
}

/* 顶栏 */
.share-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 24px;
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.brand-name {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
  letter-spacing: 0.3px;
  cursor: pointer;
  user-select: none;
}

.topbar-tag {
  font-size: 13px;
}

/* 居中态：加载 / 错误 / 密码 */
.share-center {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 40px 20px;
}

/* 错误卡 */
.error-card {
  width: 100%;
  max-width: 460px;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.06);
}

/* 密码卡 */
.password-card {
  width: 100%;
  max-width: 420px;
  padding: 28px 8px 8px;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
  text-align: center;
}

.password-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(64, 158, 255, 0.12), rgba(102, 126, 234, 0.12));
  color: #409eff;
  margin: 0 auto;
}

.password-title {
  font-size: 18px;
  font-weight: 600;
  margin: 16px 0 0;
  color: #1f2937;
}

.share-title {
  font-size: 16px;
  font-weight: 500;
  margin: 0;
  color: #374151;
  text-align: center;
}

.share-desc {
  color: #6b7280;
  margin: 0;
  font-size: 13px;
  text-align: center;
}

.password-error {
  margin: 0;
  color: #ef4444;
  font-size: 13px;
  text-align: left;
}

/* 内容展示区 */
.share-content-wrapper {
  flex: 1 1 auto;
  width: 100%;
  max-width: 980px;
  margin: 0 auto;
  padding: 32px 20px 60px;
}

.share-header {
  text-align: center;
  margin-bottom: 28px;
}

.share-main-title {
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 10px 0;
  color: #1f2937;
  letter-spacing: 0.3px;
}

.share-main-desc {
  color: #6b7280;
  margin: 0;
  font-size: 15px;
  line-height: 1.6;
  max-width: 720px;
  margin-left: auto;
  margin-right: auto;
}

.share-main {
  margin-bottom: 36px;
}

.share-footer {
  text-align: center;
  padding: 24px 0 0;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

@media (max-width: 640px) {
  .share-topbar {
    padding: 12px 16px;
  }
  .share-content-wrapper {
    padding: 20px 14px 40px;
  }
  .share-main-title {
    font-size: 22px;
  }
  .password-card {
    max-width: 100%;
  }
}
</style>

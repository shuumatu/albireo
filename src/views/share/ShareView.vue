<template>
  <div class="share-page">
    <!-- 加载状态 -->
    <div v-if="loading" class="share-center">
      <n-spin size="large" />
    </div>

    <!-- 错误状态 -->
    <div v-else-if="error" class="share-center">
      <n-result status="error" :title="error" description="该分享链接可能已过期或不存在">
        <template #footer>
          <n-button @click="router.push('/')">返回首页</n-button>
        </template>
      </n-result>
    </div>

    <!-- 需要密码 -->
    <div v-else-if="needPassword" class="share-center">
      <n-card class="password-card" title="该分享需要密码访问" :bordered="false">
        <n-space vertical :size="16">
          <p v-if="shareData?.title" class="share-title">{{ shareData.title }}</p>
          <p v-if="shareData?.description" class="share-desc">{{ shareData.description }}</p>
          <n-input
            v-model:value="passwordInput"
            type="password"
            placeholder="请输入访问密码"
            show-password-on="click"
            @keyup.enter="submitPassword"
          />
          <n-button type="primary" block :loading="submitting" @click="submitPassword">
            确认访问
          </n-button>
        </n-space>
      </n-card>
    </div>

    <!-- 分享内容展示 -->
    <div v-else-if="shareData?.content" class="share-content-wrapper">
      <header class="share-header">
        <h1>{{ shareData.title || '分享内容' }}</h1>
        <p v-if="shareData.description">{{ shareData.description }}</p>
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
        <n-text depth="3">通过分享链接查看</n-text>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMessage } from 'naive-ui'
import { getShareMeta, accessShareWithPassword } from '../../api/share'
import type { ShareAccessVO } from '../../api/share'
import VideoShareContent from './components/VideoShareContent.vue'
import ImageShareContent from './components/ImageShareContent.vue'
import CollectionShareContent from './components/CollectionShareContent.vue'

const route = useRoute()
const router = useRouter()
const message = useMessage()

const loading = ref(true)
const error = ref<string | null>(null)
const needPassword = ref(false)
const shareData = ref<ShareAccessVO | null>(null)
const passwordInput = ref('')
const submitting = ref(false)

const shareCode = route.params.shareCode as string

onMounted(async () => {
  try {
    const data = await getShareMeta(shareCode)
    shareData.value = data
    needPassword.value = data.needPassword
  } catch (e: any) {
    error.value = e.response?.data?.message || '获取分享内容失败'
  } finally {
    loading.value = false
  }
})

async function submitPassword() {
  if (!passwordInput.value) {
    message.warning('请输入密码')
    return
  }
  submitting.value = true
  try {
    const data = await accessShareWithPassword(shareCode, passwordInput.value)
    shareData.value = data
    needPassword.value = false
  } catch (e: any) {
    message.error(e.response?.data?.message || '密码错误')
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.share-page {
  min-height: 100vh;
  overflow: auto;
  background: var(--n-body-color, #f5f5f5);
}

.share-center {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: 20px;
}

.password-card {
  width: 100%;
  max-width: 400px;
}

.share-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.share-desc {
  color: #999;
  margin: 0;
}

.share-content-wrapper {
  max-width: 960px;
  margin: 0 auto;
  padding: 24px 16px;
}

.share-header {
  text-align: center;
  margin-bottom: 24px;
}

.share-header h1 {
  font-size: 24px;
  font-weight: 600;
  margin: 0 0 8px 0;
}

.share-header p {
  color: #666;
  margin: 0;
}

.share-main {
  margin-bottom: 40px;
}

.share-footer {
  text-align: center;
  padding: 20px 0;
  border-top: 1px solid #eee;
}

@media (max-width: 640px) {
  .share-content-wrapper {
    padding: 16px 12px;
  }

  .share-header h1 {
    font-size: 20px;
  }
}
</style>

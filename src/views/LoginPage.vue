<template>
  <div class="login-container">
    <router-link class="login-home" to="/"
      >ALBIREO ／ <span>返回首页 ↗</span></router-link
    >
    <div class="login-intro">
      <span class="archive-eyebrow">PERSONAL ARCHIVE</span>
      <h2>记录世界，<br />也记录自己。</h2>
      <p>让每一次相遇，都有迹可循。</p>
      <span class="login-index" aria-hidden="true">01 — ∞</span>
    </div>
    <div class="login-card hud-panel">
      <div class="login-header">
        <h1 class="login-title">ALBIREO</h1>
        <p class="login-subtitle">
          {{ isRegister ? '创建新账号' : '用户登录' }}
        </p>
        <p class="login-scope">
          普通账号可浏览公开作品；管理员账号登录后可预览私有作品。
        </p>
      </div>

      <n-form
        ref="formRef"
        :model="formData"
        :rules="currentRules"
        @keyup.enter="handleSubmit"
      >
        <n-form-item path="username" label="用户名">
          <n-input
            v-model:value="formData.username"
            placeholder="请输入用户名"
            size="large"
            :input-props="{ autocomplete: 'username' }"
          >
            <template #prefix>
              <n-icon :component="PersonIcon" />
            </template>
          </n-input>
        </n-form-item>

        <n-form-item path="password" label="密码">
          <n-input
            v-model:value="formData.password"
            type="password"
            show-password-on="click"
            placeholder="请输入密码"
            size="large"
            :input-props="{
              autocomplete: isRegister ? 'new-password' : 'current-password'
            }"
          >
            <template #prefix>
              <n-icon :component="LockIcon" />
            </template>
          </n-input>
        </n-form-item>

        <n-form-item v-if="isRegister" path="confirmPassword" label="确认密码">
          <n-input
            v-model:value="formData.confirmPassword"
            type="password"
            show-password-on="click"
            placeholder="请再次输入密码"
            size="large"
            :input-props="{ autocomplete: 'new-password' }"
          >
            <template #prefix>
              <n-icon :component="LockIcon" />
            </template>
          </n-input>
        </n-form-item>

        <div v-if="!isRegister" class="remember-row">
          <n-checkbox v-model:checked="rememberMe">记住密码</n-checkbox>
        </div>

        <n-button
          type="primary"
          block
          strong
          size="large"
          :loading="loading"
          @click="handleSubmit"
          class="login-btn"
        >
          {{ isRegister ? '注 册' : '登 录' }}
        </n-button>
      </n-form>

      <div class="login-footer">
        <span class="footer-text">{{
          isRegister ? '已有账号？' : '没有账号？'
        }}</span>
        <n-button text type="primary" @click="toggleMode">
          {{ isRegister ? '返回登录' : '立即注册' }}
        </n-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NForm, NFormItem, NInput, NIcon, NCheckbox, NButton } from 'naive-ui'
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useMessage, type FormInst, type FormRules } from 'naive-ui'
import {
  PersonOutline as PersonIcon,
  LockClosedOutline as LockIcon
} from '@vicons/ionicons5'
import { login, register } from '../api/auth'
import { saveAuthSession } from '../utils/authSession'
import {
  saveCredential,
  loadCredential,
  clearCredential
} from '../utils/credentialCrypto'

const message = useMessage()

const router = useRouter()
const formRef = ref<FormInst | null>(null)
const loading = ref(false)
const isRegister = ref(false)
const rememberMe = ref(false)

const formData = reactive({
  username: '',
  password: '',
  confirmPassword: ''
})

const loginRules: FormRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

const registerRules: FormRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 32, message: '用户名长度为 3-32 位', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, max: 64, message: '密码长度为 6-64 位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请再次输入密码', trigger: 'blur' },
    {
      validator: (_rule: any, value: string) => {
        if (value !== formData.password) {
          return new Error('两次输入的密码不一致')
        }
        return true
      },
      trigger: 'blur'
    }
  ]
}

const currentRules = computed(() =>
  isRegister.value ? registerRules : loginRules
)

onMounted(async () => {
  const saved = await loadCredential()
  if (saved) {
    formData.username = saved.username
    formData.password = saved.password
    rememberMe.value = true
  }
})

function toggleMode() {
  isRegister.value = !isRegister.value
  formRef.value?.restoreValidation()
  formData.username = ''
  formData.password = ''
  formData.confirmPassword = ''
}

async function handleSubmit() {
  if (loading.value) return
  try {
    await formRef.value?.validate()
  } catch {
    return
  }

  loading.value = true
  try {
    if (isRegister.value) {
      await register(formData.username, formData.password)
      message.success('注册成功，请登录')
      isRegister.value = false
      formData.password = ''
      formData.confirmPassword = ''
    } else {
      const data = await login(formData.username, formData.password)
      saveAuthSession(data)
      if (rememberMe.value) {
        await saveCredential(formData.username, formData.password)
      } else {
        clearCredential()
      }
      message.success('登录成功')
      const target = router.currentRoute.value.query.redirect
      const redirect = typeof target === 'string' ? target : '/'
      router.push(redirect.startsWith('/') && !redirect.startsWith('//') && !redirect.startsWith('/login') ? redirect : '/')
    }
  } catch (err: any) {
    const status = err.response?.status
    const body = err.response?.data
    const msg = typeof body === 'string' ? body : body?.message
    if (status === 400) {
      message.error(
        typeof msg === 'string'
          ? msg
          : isRegister.value
            ? '注册失败'
            : '用户名或密码错误'
      )
    } else if (status === 403) {
      message.error(typeof msg === 'string' ? msg : '权限不足')
    } else {
      message.error(
        isRegister.value ? '注册失败，请稍后重试' : '登录失败，请稍后重试'
      )
    }
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-container {
  min-height: 100dvh;
  display: grid;
  grid-template-columns: 1fr 420px;
  align-items: center;
  gap: 64px;
  padding: 112px 10% 64px;
  position: relative;
  background:
    radial-gradient(ellipse at 16% 18%, var(--star-gold-soft), transparent 48%),
    radial-gradient(ellipse at 80% 80%, var(--star-blue-soft), transparent 48%),
    linear-gradient(90deg, #10151f80, #10151ff2 72%),
    url('../assets/hero/frame-1-1920.webp') center/cover;
}
.login-home {
  position: absolute;
  top: 34px;
  left: 10%;
  font-size: 20px;
  letter-spacing: 3px;
  font-weight: 700;
  padding-left: 34px;
}
.login-home::before {
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
.login-home span {
  font-size: 11px;
  letter-spacing: 1px;
  color: var(--muted);
  margin-left: 20px;
}
.login-intro h2 {
  font-size: clamp(32px, 4vw, 64px);
  line-height: 1.45;
  letter-spacing: 3px;
  margin: 24px 0;
}
.login-intro p {
  color: var(--muted);
  letter-spacing: 3px;
}
.login-index {
  display: block;
  margin-top: 80px;
  font: 12px var(--mono);
  color: var(--star-gold);
  border-top: 1px solid var(--line);
  padding-top: 18px;
  max-width: 280px;
}
.login-card {
  padding: 40px;
  background: color-mix(in srgb, var(--surface) 95%, transparent);
  border: 1px solid var(--line);
  width: 100%;
}
.login-header {
  margin-bottom: 28px;
}
.login-title {
  font: 600 22px var(--mono);
  letter-spacing: 4px;
  margin: 0 0 12px;
  color: var(--star-gold-bright);
}
.login-subtitle,
.footer-text {
  color: var(--muted);
  font-size: 13px;
}
.login-scope {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.7;
  margin: 12px 0 0;
}
.remember-row {
  margin-bottom: 12px;
}
.login-btn {
  height: 46px;
  letter-spacing: 3px;
}
.login-footer {
  margin-top: 24px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
}
@media (max-width: 900px) {
  .login-container {
    grid-template-columns: 1fr;
    padding: 108px 24px 48px;
    gap: 32px;
    justify-items: center;
  }
  .login-home {
    left: 24px;
  }
  .login-intro {
    width: min(100%, 420px);
  }
  .login-intro h2 {
    font-size: 32px;
    margin: 12px 0;
  }
  .login-index,
  .login-intro p {
    display: none;
  }
  .login-card {
    max-width: 420px;
    padding: 28px;
  }
}
</style>

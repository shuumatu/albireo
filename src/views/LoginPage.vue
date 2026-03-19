<template>
  <n-config-provider :theme="darkTheme">
    <div class="login-container">
      <div class="login-card">
        <div class="login-header">
          <img
            src="https://albireo.shuumatu.com/uploads/0e84dd80119bbfc52609e5e4fda0b57.png"
            alt="Logo"
            class="login-logo"
          />
          <h1 class="login-title">展示系统</h1>
          <p class="login-subtitle">{{ isRegister ? '创建新账号' : '用户登录' }}</p>
        </div>

        <n-form ref="formRef" :model="formData" :rules="currentRules" @keyup.enter="handleSubmit">
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
              :input-props="{ autocomplete: isRegister ? 'new-password' : 'current-password' }"
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
          <span class="footer-text">{{ isRegister ? '已有账号？' : '没有账号？' }}</span>
          <n-button text type="primary" @click="toggleMode">
            {{ isRegister ? '返回登录' : '立即注册' }}
          </n-button>
        </div>
      </div>
    </div>
  </n-config-provider>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { darkTheme, createDiscreteApi, type FormInst, type FormRules } from 'naive-ui'
import { PersonOutline as PersonIcon, LockClosedOutline as LockIcon } from '@vicons/ionicons5'
import { login, register } from '../api/auth'

const { message } = createDiscreteApi(['message'], {
  configProviderProps: { theme: darkTheme }
})

const router = useRouter()
const formRef = ref<FormInst | null>(null)
const loading = ref(false)
const isRegister = ref(false)

const formData = reactive({
  username: '',
  password: '',
  confirmPassword: ''
})

const loginRules: FormRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' }
  ]
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

const currentRules = computed(() => isRegister.value ? registerRules : loginRules)

function toggleMode() {
  isRegister.value = !isRegister.value
  formRef.value?.restoreValidation()
  formData.username = ''
  formData.password = ''
  formData.confirmPassword = ''
}

async function handleSubmit() {
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
      localStorage.setItem('token', data.token)
      localStorage.setItem('userId', String(data.userId))
      localStorage.setItem('username', data.username)
      localStorage.setItem('role', data.role)
      message.success('登录成功')
      const redirect = (router.currentRoute.value.query.redirect as string) || '/'
      router.push(redirect)
    }
  } catch (err: any) {
    const status = err.response?.status
    const msg = err.response?.data
    if (status === 400) {
      message.error(typeof msg === 'string' ? msg : (isRegister.value ? '注册失败' : '用户名或密码错误'))
    } else if (status === 403) {
      message.error(typeof msg === 'string' ? msg : '权限不足')
    } else {
      message.error(isRegister.value ? '注册失败，请稍后重试' : '登录失败，请稍后重试')
    }
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%);
}

.login-card {
  width: 400px;
  padding: 48px 40px;
  background: rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(20px);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.login-header {
  text-align: center;
  margin-bottom: 36px;
}

.login-logo {
  height: 56px;
  margin-bottom: 16px;
}

.login-title {
  font-size: 24px;
  font-weight: 600;
  color: #fff;
  margin: 0 0 8px 0;
  letter-spacing: 1px;
}

.login-subtitle {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.5);
  margin: 0;
}

.login-btn {
  margin-top: 12px;
  height: 44px;
  font-size: 16px;
  letter-spacing: 4px;
}

.login-footer {
  margin-top: 20px;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.footer-text {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.5);
}

:deep(.n-form-item-label) {
  color: rgba(255, 255, 255, 0.7) !important;
}
</style>

<template>
  <div class="profile-container">
    <n-grid :cols="24" :x-gap="24" responsive="screen" item-responsive>
      <n-gi span="24 m:8">
        <n-card title="账户信息">
          <div class="user-info">
            <n-avatar :size="72" round class="user-avatar">
              {{ username?.charAt(0).toUpperCase() }}
            </n-avatar>
            <div class="user-details">
              <n-descriptions label-placement="left" :column="1" bordered size="small">
                <n-descriptions-item label="用户名">
                  {{ username }}
                </n-descriptions-item>
                <n-descriptions-item label="用户 ID">
                  {{ userId }}
                </n-descriptions-item>
                <n-descriptions-item label="角色">
                  <n-tag :type="role === 'ADMIN' ? 'warning' : 'info'" size="small">
                    {{ role === 'ADMIN' ? '管理员' : '普通用户' }}
                  </n-tag>
                </n-descriptions-item>
              </n-descriptions>
            </div>
          </div>

          <n-divider />

          <n-button block type="error" secondary @click="handleLogout">
            退出登录
          </n-button>
        </n-card>
      </n-gi>

      <n-gi span="24 m:16">
        <n-card title="修改密码">
          <n-form
            ref="formRef"
            :model="formData"
            :rules="rules"
            label-placement="left"
            label-width="100"
            require-mark-placement="right-hanging"
            style="max-width: 480px"
          >
            <n-form-item label="当前密码" path="oldPassword">
              <n-input
                v-model:value="formData.oldPassword"
                type="password"
                show-password-on="click"
                placeholder="请输入当前密码"
              />
            </n-form-item>

            <n-form-item label="新密码" path="newPassword">
              <n-input
                v-model:value="formData.newPassword"
                type="password"
                show-password-on="click"
                placeholder="请输入新密码（6-64 位）"
              />
            </n-form-item>

            <n-form-item label="确认新密码" path="confirmPassword">
              <n-input
                v-model:value="formData.confirmPassword"
                type="password"
                show-password-on="click"
                placeholder="请再次输入新密码"
              />
            </n-form-item>

            <n-form-item>
              <n-button
                type="primary"
                :loading="loading"
                @click="handleChangePassword"
              >
                确认修改
              </n-button>
            </n-form-item>
          </n-form>
        </n-card>
      </n-gi>
    </n-grid>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useMessage, type FormInst, type FormRules } from 'naive-ui'
import { changePassword } from '../api/auth'

const router = useRouter()
const message = useMessage()
const formRef = ref<FormInst | null>(null)
const loading = ref(false)

const username = localStorage.getItem('username') || ''
const userId = localStorage.getItem('userId') || ''
const role = localStorage.getItem('role') || 'USER'

const formData = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const rules: FormRules = {
  oldPassword: [
    { required: true, message: '请输入当前密码', trigger: 'blur' }
  ],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, max: 64, message: '密码长度为 6-64 位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    {
      validator: (_rule: any, value: string) => {
        if (value !== formData.newPassword) {
          return new Error('两次输入的密码不一致')
        }
        return true
      },
      trigger: 'blur'
    }
  ]
}

function handleLogout() {
  localStorage.removeItem('token')
  localStorage.removeItem('userId')
  localStorage.removeItem('username')
  localStorage.removeItem('role')
  router.push('/login')
}

async function handleChangePassword() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }

  loading.value = true
  try {
    await changePassword(formData.oldPassword, formData.newPassword)
    message.success('密码修改成功，请重新登录')
    formData.oldPassword = ''
    formData.newPassword = ''
    formData.confirmPassword = ''
    setTimeout(() => {
      handleLogout()
    }, 1500)
  } catch (err: any) {
    const status = err.response?.status
    const msg = err.response?.data
    if (status === 400) {
      message.error(typeof msg === 'string' ? msg : '密码修改失败')
    } else if (status === 401) {
      message.error('登录已过期，请重新登录')
    } else {
      message.error('操作失败，请稍后重试')
    }
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.profile-container {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
}

.user-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.user-avatar {
  background: linear-gradient(135deg, #302b63, #24243e);
  color: #fff;
  font-size: 28px;
  font-weight: 600;
}

.user-details {
  width: 100%;
}
</style>

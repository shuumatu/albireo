<template>
  <n-layout-header class="header" bordered>
    <!-- 左侧 logo -->
    <div class="logo">
      <router-link to="/">
        <img
          src="https://pub-c0df82893db742e6a27b16b5c6602044.r2.dev/colorSignature.png"
          alt="Logo"
        />
      </router-link>
    </div>

    <!-- 右侧区域 -->
    <div class="right-section">
      <div class="menu-wrapper">
        <n-menu
          mode="horizontal"
          :options="menuOptions"
          :value="activeKey"
          @update:value="handleMenuSelect"
          class="menu"
        />
      </div>

      <n-dropdown :options="userMenuOptions" @select="handleUserMenuSelect">
        <n-button text class="user-btn">
          <n-avatar :size="28" round class="user-avatar-small">
            {{ username?.charAt(0)?.toUpperCase() || 'U' }}
          </n-avatar>
          <span class="username-text">{{ username || '用户' }}</span>
        </n-button>
      </n-dropdown>
    </div>
  </n-layout-header>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const activeKey = ref(route.path)

watch(route, () => {
  activeKey.value = route.path
})

const username = computed(() => localStorage.getItem('username') || '')

const menuOptions = [
  {
    label: '地图',
    key: '/map'
  },
  {
    label: '时间线',
    key: '/timeline'
  }
]

const userMenuOptions = [
  { label: '个人中心', key: 'profile' },
  { type: 'divider', key: 'd1' },
  { label: '退出登录', key: 'logout' }
]

function handleMenuSelect(key) {
  router.push(key)
}

function handleUserMenuSelect(key) {
  if (key === 'profile') {
    router.push('/profile')
  } else if (key === 'logout') {
    localStorage.removeItem('token')
    localStorage.removeItem('userId')
    localStorage.removeItem('username')
    localStorage.removeItem('role')
    router.push('/login')
  }
}
</script>

<style scoped>
.header {
  background-color: black;
  color: white;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 64px;
  padding: 0 20px;
}

/* 左侧 logo */
.logo img {
  height: 40px;
}

.right-section {
  display: flex;
  align-items: center;
  gap: 16px;
}

.menu-wrapper {
  display: flex;
  align-items: center;
}

/* 菜单样式 */
.menu :deep(.n-menu-item) {
  color: white;
  position: relative;
  padding: 0 20px;
}

/* 菜单项悬停样式 */
.menu :deep(.n-menu-item:hover) {
  background-color: #ffffff5e;
  color: white;
}

/* 菜单项之间添加竖线 */
.menu :deep(.n-menu-item:not(:last-child)::after) {
  content: '';
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  height: 20px;
  width: 1px;
  background-color: white;
}

.user-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  color: white !important;
  cursor: pointer;
}

.user-avatar-small {
  background: linear-gradient(135deg, #302b63, #24243e);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  flex-shrink: 0;
}

.username-text {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.85);
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>

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

    <!-- 右侧菜单 -->
    <div class="menu-wrapper">
      <n-menu
        mode="horizontal"
        :options="menuOptions"
        :value="activeKey"
        @update:value="handleMenuSelect"
        class="menu"
      />
    </div>
  </n-layout-header>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const activeKey = ref(route.path)

// 根据当前路径更新激活菜单项
watch(route, () => {
  activeKey.value = route.path
})

// 菜单选项
const menuOptions = [
  {
    label: '地图',
    key: '/map'
  },
  {
    label:'首页',
    key: '/gallery'
  }
]

// 点击菜单时导航
function handleMenuSelect(key) {
  router.push(key)
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

/* 菜单容器 */
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
</style>

<template>
  <template v-if="route.meta.fullScreen">
    <router-view />
  </template>
  <n-message-provider v-else-if="route.meta.hideLayout">
    <router-view />
  </n-message-provider>
  <n-message-provider v-else>
    <n-layout class="app-layout">
      <n-layout-header bordered class="app-header">
        <AppHeader />
      </n-layout-header>
      <n-layout-content class="app-content">
        <div class="content-wrapper">
          <router-view />
        </div>
      </n-layout-content>
    </n-layout>
  </n-message-provider>
</template>

<script setup>
import { useRoute } from 'vue-router'
import AppHeader from './components/AppHeader.vue'

const route = useRoute()
</script>

<style>
/* 全局样式 - 禁止 body 和 html 滚动 */
html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  overflow: hidden; /* 禁止整个页面滚动 */
}

#app {
  height: 100%;
  overflow: hidden;
}
</style>

<style scoped>
.app-layout {
  height: 100vh;
  overflow: hidden;
}

.app-header {
  height: 64px;
  flex-shrink: 0; /* 防止 header 被压缩 */
}

.app-content {
  height: calc(100vh - 64px);
  overflow: hidden; /* layout-content 本身不滚动 */
}

.content-wrapper {
  height: 100%;
  width: 100%;
  overflow: auto; /* 改为 hidden，禁止 router-view 层级的滚动 */
  position: relative;
}
</style>
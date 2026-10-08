<script setup lang="ts">
import { NConfigProvider, NMessageProvider, NDialogProvider } from 'naive-ui'
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { darkTheme } from 'naive-ui'
import AppHeader from './components/AppHeader.vue'
import SiteFooter from './components/SiteFooter.vue'
import AlbireoCursor from './components/AlbireoCursor.vue'
import { archiveTheme } from './theme/archive'
import { gallerySessionRevision } from './utils/authSession'
const route = useRoute()
const standalone = computed(
  () => route.meta.fullScreen || route.meta.hideLayout
)
const workspace = computed(
  () => route.name === 'Map' || route.name === 'Timeline'
)
</script>
<template>
  <AlbireoCursor />
  <n-config-provider :theme="darkTheme" :theme-overrides="archiveTheme">
    <n-message-provider
      ><n-dialog-provider>
        <div class="site-shell" :class="{ 'workspace-shell': workspace }">
          <a class="skip-link" href="#site-main">跳到内容</a>
          <AppHeader v-if="!standalone" />
          <main
            id="site-main"
            tabindex="-1"
            :class="{ 'workspace-content': workspace }"
          >
            <router-view v-slot="{ Component }"
              ><keep-alive include="TimeLine" :key="gallerySessionRevision"
                ><component :is="Component" :key="route.path" /></keep-alive
            ></router-view>
          </main>
          <SiteFooter v-if="!standalone && !workspace" />
        </div> </n-dialog-provider
    ></n-message-provider>
  </n-config-provider>
</template>

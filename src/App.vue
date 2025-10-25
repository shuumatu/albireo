<template>
  <n-layout >
        <n-layout-header bordered>
          <AppHeader />
        </n-layout-header>
        <n-layout-content>
          <div class="content-wrapper">
            <router-view />
          </div>
        </n-layout-content>
      </n-layout>
</template>

<script setup>

import { ref } from 'vue'
import AppHeader from './components/AppHeader.vue';

const href = ref('http://localhost:5173/video/7583f915-6ef1-474b-a3e4-b427b8d97068')
</script>
<style scoped>
.content-wrapper {
  min-height: calc(100vh - 64px);
  width: 100%;
  position: relative;
}
</style>

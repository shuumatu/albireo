<template>
    <div class="video-container">
      <video
        v-if="url"
        ref="videoRef"
        class="plyr"
        controls
        playsinline
      >
        <source :src="url" type="video/mp4" />
      </video>
    </div>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import {getVideoUrl} from "../api/video"
import { onMounted, ref, onBeforeUnmount, nextTick } from 'vue'
import Plyr from 'plyr'
import 'plyr/dist/plyr.css'

let url = ref<any | null>(null)

const route = useRoute()
const videoId = route.params.uuid as string

const videoRef = ref<HTMLVideoElement | null>(null)
let player: Plyr | null = null

async function getUrl(){
  try {
    const res = await getVideoUrl(videoId);
    console.log('API响应:', res);
    // 根据你的request.ts配置，API返回的是response.data
    url.value = res;
    console.log('设置视频URL:', url.value);
  } catch (error) {
    console.error('获取视频URL失败:', error);
  }
}

onMounted(async () => {
  await getUrl();
  
  // 等待下一个tick确保DOM已更新
  await nextTick();
  
  if (videoRef.value && url.value) {
    console.log('初始化Plyr播放器');
    player = new Plyr(videoRef.value, {
      controls: [
        'play',
        'progress',
        'current-time',
        'mute',
        'volume',
        'settings',   // 必须启用 settings 才能看到速度等选项
        'pip',        // Picture-in-Picture
        'fullscreen'
      ],
        settings: ['speed'], // 可配置内容，最少包括 speed
        speed: {
            selected: 1,
            options: [0.5, 0.75, 1, 1.25, 1.5, 2]
        }

    })
  }
})

onBeforeUnmount(() => {
  if (player) {
    player.destroy()
  }
})
</script>

<style scoped>
.video-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}
.plyr {
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.15);
}
</style>
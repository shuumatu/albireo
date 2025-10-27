import { createApp } from 'vue'
import naive from 'naive-ui'
import router from './router'
import { MotionPlugin } from '@vueuse/motion'
import VueVideoPlayer from '@videojs-player/vue'
import 'video.js/dist/video-js.css'


import App from './App.vue'
const app = createApp(App)
app.use(MotionPlugin)
app.use(naive)
app.use(router)
app.use(VueVideoPlayer)


app.mount('#app')
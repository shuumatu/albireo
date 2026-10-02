import { createApp } from 'vue'
import router from './router'
import { MotionPlugin } from '@vueuse/motion'
import './styles/archive.css'
import './views/map/mapTokens.css'

import App from './App.vue'
const app = createApp(App)
app.use(router)
app.use(MotionPlugin)

app.mount('#app')

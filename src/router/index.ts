import { createRouter, createWebHistory } from 'vue-router'
import VideoPlayer from '../views/videoPlayer.vue'
import MainPage from '../views/mainPage.vue'
import Map from '../views/Map.vue'
import ResourceGallery from '../views/ResourceGallery.vue'

const routes = [
    {
        path: '/video/:uuid',
        name: 'VideoPlayer',
        component:VideoPlayer
    },
    {
        path: '/',
        name: 'Home',
        component:MainPage
    },
    {
        path:'/map',
        name:'Map',
        component:Map
    },
    {
        path: '/gallery',
        name: 'Gallery',
        component:ResourceGallery
    }


]

const router = createRouter({
  history: createWebHistory(), // 使用 HTML5 模式
  routes
})

export default router

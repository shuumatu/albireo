import { createRouter, createWebHistory } from 'vue-router'
import MainPage from '../views/mainPage.vue'
import Map from '../views/Map.vue'
import ResourceGallery from '../views/ResourceGallery.vue'
import VideoDetail from '../views/VideoDetail.vue'
import VideoPlayer from '../components/VideoPlayer.vue'

const routes = [
    {
        path: '/video/',
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

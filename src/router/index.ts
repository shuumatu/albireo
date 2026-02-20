import { createRouter, createWebHistory } from 'vue-router'
import MainPage from '../views/mainPage.vue'
import Map from '../views/Map.vue'
import ResourceGallery from '../views/ResourceGallery.vue'
import VideoDetail from '../views/VideoDetail.vue'
import VideoPlayer from '../components/VideoPlayer.vue'
import TimeLine from '../views/TimeLine.vue'

const routes = [
    {
        path: '/video/:uuid',
        name: 'VideoPlayer',
        component:VideoDetail
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
    },
    {
        path:'/timneline',
        name:'Timeline',
        component:TimeLine
    }


]

const router = createRouter({
  history: createWebHistory(), // 使用 HTML5 模式
  routes
})

export default router

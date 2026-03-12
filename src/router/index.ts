import { createRouter, createWebHistory } from 'vue-router'
import MainPage from '../views/mainPage.vue'
import Map from '../views/Map.vue'
import ResourceGallery from '../views/ResourceGallery.vue'
import VideoDetail from '../views/VideoDetail.vue'
import TimeLine from '../views/TimeLine.vue'
import ImageDetail from '../views/ImageDetail.vue'
import LoginPage from '../views/LoginPage.vue'
import UserProfile from '../views/UserProfile.vue'

const routes = [
    {
        path: '/login',
        name: 'Login',
        component: LoginPage,
        meta: { fullScreen: true }
    },
    {
        path: '/profile',
        name: 'Profile',
        component: UserProfile
    },
    {
        path: '/video/:uuid',
        name: 'VideoPlayer',
        component: VideoDetail
    },
    {
        path: '/image/:uuid',
        name: 'ImageDetail',
        component: ImageDetail
    },
    {
        path: '/',
        name: 'Home',
        component: MainPage
    },
    {
        path: '/map',
        name: 'Map',
        component: Map
    },
    {
        path: '/gallery',
        name: 'Gallery',
        component: ResourceGallery
    },
    {
        path: '/timneline',
        name: 'Timeline',
        component: TimeLine
    }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem('token')
  if (to.name !== 'Login' && !token) {
    next({ name: 'Login', query: { redirect: to.fullPath } })
  } else if (to.name === 'Login' && token) {
    next({ path: '/' })
  } else {
    next()
  }
})

export default router

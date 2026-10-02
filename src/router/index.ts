import { createRouter, createWebHistory } from 'vue-router'
import MainPage from '../views/mainPage.vue'

const routes = [
  {
    path: '/s/:shareCode',
    name: 'ShareView',
    component: () => import('../views/share/ShareView.vue'),
    meta: { hideLayout: true, requiresAuth: false }
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/LoginPage.vue'),
    meta: { fullScreen: true }
  },
  {
    path: '/profile',
    name: 'Profile',
    component: () => import('../views/UserProfile.vue')
  },
  {
    path: '/video/:uuid',
    name: 'VideoPlayer',
    component: () => import('../views/VideoDetail.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/image/:uuid',
    name: 'ImageDetail',
    component: () => import('../views/ImageDetail.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/',
    name: 'Home',
    component: MainPage,
    meta: { requiresAuth: false }
  },
  {
    path: '/map',
    name: 'Map',
    component: () => import('../views/Map.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/timeline',
    name: 'Timeline',
    component: () => import('../views/TimeLine.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/search',
    name: 'Search',
    component: () => import('../views/Search.vue'),
    meta: { requiresAuth: false }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, _from, saved) {
    if (saved) return saved
    if (to.hash) return { el: to.hash, top: 24 }
    return { top: 0 }
  }
})

router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem('token')
  if (to.meta.requiresAuth === false || to.name === 'Login') {
    if (to.name === 'Login' && token) {
      next({ path: '/' })
    } else {
      next()
    }
  } else if (!token) {
    next({ name: 'Login', query: { redirect: to.fullPath } })
  } else {
    next()
  }
})

const pageTitles: Record<string, string> = {
  Home: '个人影像档案',
  Timeline: '时间线',
  Map: '影像地图',
  Search: '搜索',
  Login: '登录',
  Profile: '个人中心',
  ImageDetail: '摄影作品',
  VideoPlayer: '视频作品',
  ShareView: '分享'
}
router.afterEach((to) => {
  document.title = `${pageTitles[String(to.name)] || '影像档案'} · ALBIREO`
})
export default router

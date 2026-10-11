import { createApp, h, ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import RecommendSection from '../src/components/RecommendSection.vue'
import MediaCard from '../src/components/MediaCard.vue'
import type { RecommendItemVO } from '../src/api/recommend'
import '../src/styles/archive.css'

const count = ref(6)
const cardWidth = ref(100)
const loading = ref(false)
const error = ref<string | null>(null)
const item = ref<RecommendItemVO>({
  id: 1, uuid: 'cover-test', itemType: 'image', title: '海边日落',
  thumbnailUrl: '/__cards/broken.webp', shotAt: null,
  createdAt: '2026-10-09', likeCount: 12, commentCount: 3
})
const button = (label: string, action: () => void) => h('button', { onClick: action, type: 'button' }, label)
const router = createRouter({ history: createMemoryHistory(), routes: [
  { path: '/', component: { render: () => null } },
  { path: '/image/:uuid', name: 'ImageDetail', component: { render: () => null } },
  { path: '/video/:uuid', name: 'VideoPlayer', component: { render: () => null } }
] })

createApp({
  setup() {
    return () => h('main', { style: 'width:min(420px,calc(100vw - 32px));margin:16px auto' }, [
      h('nav', { style: 'display:flex;flex-wrap:wrap;gap:8px' }, [
        button('单张', () => { count.value = 1 }),
        button('三张', () => { count.value = 3 }),
        button('六张', () => { count.value = 6 }),
        button('加宽卡片', () => { cardWidth.value = 200 }),
        button('开始加载', () => { loading.value = true }),
        button('加载失败', () => { loading.value = false; error.value = '网络不可用' }),
        button('清空', () => { count.value = 0 }),
        button('修复封面', () => { item.value = { ...item.value, thumbnailUrl: '/__cards/repaired.webp' } }),
        button('刷新同一作品', () => { item.value = { ...item.value } }),
        button('失败衍生图', () => { item.value = { ...item.value,
          thumbnailUrl: '/__cards/fallback.webp',
          renditions: [{ role: 'thumb', width: 400, height: 300, mimeType: 'image/webp', url: '/__cards/broken-rendition.webp' }]
        } }),
        button('仅衍生图', () => { item.value = { ...item.value, thumbnailUrl: null,
          renditions: [{ role: 'thumb', width: 400, height: 300, mimeType: 'image/webp', url: '/__cards/rendition.webp' }]
        } })
      ]),
      h(RecommendSection, {
        title: '测试作品', hasItems: count.value > 0,
        loading: loading.value, error: error.value, smoothDrag: true,
        onRetry: () => { error.value = null }
      }, {
        default: () => Array.from({ length: count.value }, (_, index) => h('div', {
          key: index, class: 'fixture-card',
          style: { width: `${cardWidth.value}px`, height: '100px', flexShrink: 0, background: '#456' }
        }, `作品 ${index + 1}`)),
        empty: () => h('a', { href: '/timeline' }, '浏览时间线')
      }),
      h(RecommendSection, { title: '封面检查', hasItems: true }, {
        default: () => h(MediaCard, { item: item.value })
      })
    ])
  }
}).use(router).mount('#app')

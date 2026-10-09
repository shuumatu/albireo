<script setup lang="ts">
import {
  ref,
  computed,
  onMounted,
  onUnmounted,
  onActivated,
  onDeactivated,
  nextTick,
  watch
} from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { layoutTimeline } from '../utils/timelineLayout'
import type { MediaRendition } from '../types/media'
import TimelineMedia from '../components/TimelineMedia.vue'
import TimelineScrubber from '../components/TimelineScrubber.vue'
import { isAdminPreview } from '../utils/authSession'
defineOptions({ name: 'TimeLine' })
import {
  getTimelineStatistics,
  getTimelineBucket,
  type TimelineStatistics,
  type TimelineBucket,
  type BucketPhoto
} from '../api/timeline'

interface Photo {
  renditions?: MediaRendition[]
  id: string
  url: string
  date: Date
  coverUrl?: string
  thumbnailUrl?: string
  mediaType?: string
  naturalWidth?: number
  naturalHeight?: number
}

interface TimeGroup {
  year: number
  month: number
  day: number
  title: string
  photos: Photo[]
  isLoaded: boolean
  isLoading: boolean
  estimatedCount?: number // 新增：该月预估的照片数量
}

// Props
interface Props {
  photos?: Photo[]
}

const props = withDefaults(defineProps<Props>(), {
  photos: () => []
})

// 状态
const mainContent = ref<HTMLElement>()
const photoFlow = ref<HTMLElement>()
const flowWidth = ref(800)
const imageDimensions = ref(
  new Map<string, { width: number; height: number }>()
)
const isScrubbing = ref(false)
const selectedDateKey = ref('')
const activeTimelineMonth = ref('')
const timelineEndSpace = ref(0)

// 数据加载状态
const statistics = ref<TimelineStatistics | null>(null)
const monthlyDistribution = ref<Map<string, number>>(new Map()) // key: "year-month", value: count
const loadedBuckets = ref<Map<string, TimelineBucket>>(new Map())
const pendingBuckets = ref(new Set<string>())
const failedBuckets = ref(new Set<string>())
const isInitializing = ref(true)
const loadingError = ref<string>('')
const mediaDetailRoute = (photo: Photo) => {
  const isVideo =
    photo.mediaType &&
    (photo.mediaType.startsWith('video/') || photo.mediaType === 'video')
  return {
    name: isVideo ? 'VideoPlayer' : 'ImageDetail',
    params: { uuid: photo.id }
  }
}

// 常量
const LOAD_THRESHOLD = 1000

// 格式化日期标题
const formatDateTitle = (year: number, month: number, day: number): string => {
  const date = new Date(year, month - 1, day)
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  const weekday = weekdays[date.getDay()]

  // 获取当前年份
  const currentYear = new Date().getFullYear()

  // 如果是今年以前的日期，加上年份
  if (year < currentYear) {
    return `${year}年${month}月${day}日 周${weekday}`
  }

  // 今年的日期不加年份
  return `${month}月${day}日 周${weekday}`
}

const photoRatio = (photo: Photo): number => {
  const size = imageDimensions.value.get(photo.url)
  if (size) return size.width / size.height
  if (photo.naturalWidth && photo.naturalHeight)
    return photo.naturalWidth / photo.naturalHeight
  return 1
}

// 处理图片加载完成
const handleImageLoad = (img: HTMLImageElement, photo: Photo) => {
  if (img.naturalWidth && img.naturalHeight) {
    const size = imageDimensions.value.get(photo.url)
    if (size?.width === img.naturalWidth && size.height === img.naturalHeight)
      return
    const anchor = captureScrollAnchor()
    imageDimensions.value.set(photo.url, {
      width: img.naturalWidth,
      height: img.naturalHeight
    })
    nextTick(() => {
      restoreScrollAnchor(anchor)
    })
  }
}

const getDisplayUrl = (photo: BucketPhoto): string => photo.coverUrl || ''

// 根据后端返回的月份分布生成占位组
const generateMonthPlaceholders = (): TimeGroup[] => {
  if (!statistics.value || !statistics.value.monthlyDistribution) return []

  const groups: TimeGroup[] = []

  // 按时间倒序排列（从最新到最早）
  const sortedMonths = [...statistics.value.monthlyDistribution].sort(
    (a, b) => {
      if (a.year !== b.year) return b.year - a.year
      return b.month - a.month
    }
  )

  sortedMonths.forEach(({ year, month, count }) => {
    // 为有数据的月份创建占位组
    groups.push({
      year,
      month,
      day: 15, // 使用月份中间的日期作为占位
      title: `${year}年${month}月`,
      photos: [],
      isLoaded: false,
      isLoading: pendingBuckets.value.has(`${year}-${month}`),
      estimatedCount: count
    })

    // 保存月份数据量到 Map
    monthlyDistribution.value.set(`${year}-${month}`, count)
  })

  return groups
}

// 按天分组照片
const timeGroups = computed((): TimeGroup[] => {
  if (props.photos.length > 0) {
    // 使用传入的 photos
    const groups = new Map<string, Photo[]>()
    props.photos.forEach((photo) => {
      const year = photo.date.getFullYear()
      const month = photo.date.getMonth() + 1
      const day = photo.date.getDate()
      const key = `${year}-${month}-${day}`
      if (!groups.has(key)) {
        groups.set(key, [])
      }
      groups.get(key)!.push(photo)
    })
    return Array.from(groups.entries())
      .map(([key, photos]) => {
        const parts = key.split('-').map(Number)
        const year = parts[0]
        const month = parts[1]
        const day = parts[2]
        return {
          year,
          month,
          day,
          title: formatDateTitle(year, month, day),
          photos,
          isLoaded: true,
          isLoading: false
        }
      })
      .sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year
        if (a.month !== b.month) return b.month - a.month
        return b.day - a.day
      })
  }

  // 使用智能占位
  const placeholders = generateMonthPlaceholders()
  const allGroups: TimeGroup[] = []

  placeholders.forEach((placeholder) => {
    const bucketKey = `${placeholder.year}-${placeholder.month}`
    const bucket = loadedBuckets.value.get(bucketKey)

    if (bucket) {
      // 已加载数据，按天分组
      const dayGroups = new Map<number, BucketPhoto[]>()
      // 使用 bucket.media 而不是 bucket.photos，因为后端返回的字段名是 media
      const mediaList = bucket.media || []
      mediaList.forEach((photo) => {
        const photoDate = new Date(photo.createdAt)
        const day = photoDate.getDate()
        if (!dayGroups.has(day)) {
          dayGroups.set(day, [])
        }
        dayGroups.get(day)!.push(photo)
      })

      // 转换为 TimeGroup
      Array.from(dayGroups.entries())
        .sort((a, b) => b[0] - a[0])
        .forEach(([day, photos]) => {
          allGroups.push({
            year: placeholder.year,
            month: placeholder.month,
            day,
            title: formatDateTitle(placeholder.year, placeholder.month, day),
            photos: photos.map((p) => {
              const displayUrl = getDisplayUrl(p)
              return {
                renditions: p.renditions,
                id: p.uuid,
                url: displayUrl,
                date: new Date(p.createdAt),
                coverUrl: p.coverUrl === null ? undefined : p.coverUrl, // 将 null 转换为 undefined
                thumbnailUrl: p.thumbnailUrl || undefined,
                naturalWidth: p.width ?? undefined,
                naturalHeight: p.height ?? undefined,
                mediaType: p.mediaType
              }
            }),
            isLoaded: true,
            isLoading: false
          })
        })
    } else {
      // 未加载，使用占位
      allGroups.push(placeholder)
    }
  })

  return allGroups
})

const layoutRows = computed(() =>
  layoutTimeline<Photo, TimeGroup>(
    timeGroups.value,
    flowWidth.value,
    flowWidth.value < 600 ? 150 : 200,
    photoRatio
  )
)
const groupKey = (group: TimeGroup) =>
  `${group.year}-${group.month}-${group.day}`

// 加载指定月份的数据
const loadBucketData = async (year: number, month: number) => {
  const bucketKey = `${year}-${month}`

  // 检查该月份是否有数据
  if (!monthlyDistribution.value.has(bucketKey)) {
    console.log(`月份 ${bucketKey} 没有数据，跳过加载`)
    return
  }

  // 如果已经加载或正在加载，跳过
  if (loadedBuckets.value.has(bucketKey) || pendingBuckets.value.has(bucketKey))
    return
  pendingBuckets.value.add(bucketKey)
  failedBuckets.value.delete(bucketKey)

  // 查找并标记为加载中
  const groupIndex = timeGroups.value.findIndex(
    (g) => g.year === year && g.month === month && !g.isLoaded
  )
  if (groupIndex !== -1) {
    timeGroups.value[groupIndex].isLoading = true
  }

  try {
    const bucket = await getTimelineBucket(year, month)
    const anchor = captureScrollAnchor()
    loadedBuckets.value.set(bucketKey, bucket)
    await nextTick()
    restoreScrollAnchor(anchor)
  } catch (error) {
    failedBuckets.value.add(bucketKey)
    console.error(`加载 ${year}-${month} 数据失败:`, error)
    if (groupIndex !== -1) {
      if (timeGroups.value[groupIndex])
        timeGroups.value[groupIndex].isLoading = false
    }
  } finally {
    pendingBuckets.value.delete(bucketKey)
  }
}

// 检查哪些月份需要加载
const checkAndLoadVisibleBuckets = () => {
  if (!mainContent.value) return

  const scrollTop = mainContent.value.scrollTop
  const viewportHeight = mainContent.value.clientHeight

  timeGroups.value.forEach((group) => {
    if (
      group.isLoaded ||
      group.isLoading ||
      failedBuckets.value.has(`${group.year}-${group.month}`)
    )
      return

    const key = `${group.year}-${group.month}-${group.day}`
    const element = document.querySelector(
      `[data-group="${key}"]`
    ) as HTMLElement

    if (element) {
      const elementTop = element.offsetTop
      const elementBottom = elementTop + element.offsetHeight

      // 如果元素在可视区域附近
      if (
        elementBottom >= scrollTop - LOAD_THRESHOLD &&
        elementTop <= scrollTop + viewportHeight + LOAD_THRESHOLD
      ) {
        loadBucketData(group.year, group.month)
      }
    }
  })
}

// 初始化：加载统计数据
const initializeTimeline = async () => {
  try {
    isInitializing.value = true
    loadingError.value = ''

    statistics.value = await getTimelineStatistics()

    // 等待 DOM 更新
    setTimeout(() => {
      checkAndLoadVisibleBuckets()
    }, 100)
  } catch (error) {
    console.error('加载时间轴统计数据失败:', error)
    loadingError.value = '加载失败，请刷新重试'
  } finally {
    isInitializing.value = false
  }
}

// Keep the date rail aware of both data changes and photo row repacking.
const scrubberEntries = computed(() => {
  // Repacking may move dates even when the overall flow height stays unchanged.
  layoutRows.value
  return timeGroups.value.map(group => ({
    key: groupKey(group),
    year: group.year,
    month: group.month,
    title: group.title,
    count: group.estimatedCount ?? group.photos.length,
    loaded: group.isLoaded
  }))
})
const handleScroll = () => checkAndLoadVisibleBuckets()
function seekTimelineDate(year: number, month: number) {
  requestedMonth = ''
  void loadBucketData(year, month)
}
function releaseTimelineSelection() {
  requestedMonth = ''
  if (selectedDateKey.value && mainContent.value) {
    // Stop the date animation before handing scrolling back to the user.
    mainContent.value.scrollTo({ top: mainContent.value.scrollTop, behavior: 'auto' })
  }
  selectedDateKey.value = ''
}
function updateCurrentTimelineMonth(year: number, month: number) {
  activeTimelineMonth.value = `${year}-${month}`
}

// 缓存页面时保留滚动位置，并在离开时释放全局监听。
let savedScroll = 0
let savedAnchor: ReturnType<typeof captureScrollAnchor> = null
let requestedMonth = ''
function captureScrollAnchor() {
  const root = mainContent.value
  if (!root) return null
  const group = [...root.querySelectorAll<HTMLElement>('[data-group]')].find(
    (el) => el.offsetTop + el.offsetHeight > root.scrollTop
  )
  return group
    ? {
        key: group.dataset.group!,
        fragment: group.dataset.fragment!,
        offset: root.scrollTop - group.offsetTop,
        atEnd: root.scrollTop > 0 && root.scrollHeight - root.clientHeight - root.scrollTop < 1
      }
    : null
}
function restoreScrollAnchor(anchor: ReturnType<typeof captureScrollAnchor>) {
  const root = mainContent.value
  if (!root || isScrubbing.value || selectedDateKey.value) return
  if (anchor) {
    if (anchor.atEnd) {
      root.scrollTop = root.scrollHeight - root.clientHeight
      return
    }
    const target =
      root.querySelector<HTMLElement>(`[data-fragment="${anchor.fragment}"]`) ??
      root.querySelector<HTMLElement>(`[data-group="${anchor.key}"]`)
    if (target) root.scrollTop = target.offsetTop + anchor.offset
  }
}
onBeforeRouteLeave(() => {
  savedScroll = mainContent.value?.scrollTop ?? 0
  savedAnchor = captureScrollAnchor()
})
const handleResize = () => {
  nextTick(() => {
    handleScroll()
  })
}
const measureFlow = () => {
  if (!photoFlow.value?.clientWidth) return
  if (flowWidth.value === photoFlow.value.clientWidth) return
  const anchor = captureScrollAnchor()
  flowWidth.value = photoFlow.value.clientWidth
  nextTick(() => {
    restoreScrollAnchor(anchor)
  })
}
const flowObserver = new ResizeObserver(measureFlow)
onMounted(() => {
  if (photoFlow.value) flowObserver.observe(photoFlow.value)
  measureFlow()
  if (!props.photos.length) void initializeTimeline()
  else isInitializing.value = false
})
onActivated(async () => {
  await nextTick()
  if (mainContent.value) mainContent.value.scrollTop = savedScroll
  requestedMonth = ''
  restoreScrollAnchor(savedAnchor)
  window.addEventListener('resize', handleResize)
  if (photoFlow.value) flowObserver.observe(photoFlow.value)
  measureFlow()
  handleResize()
})
onDeactivated(() => {
  window.removeEventListener('resize', handleResize)
  flowObserver.disconnect()
  isScrubbing.value = false
  requestedMonth = ''
})
onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  flowObserver.disconnect()
})
const monthOptions = computed(() =>
  [...(statistics.value?.monthlyDistribution ?? [])].sort(
    (a, b) => b.year - a.year || b.month - a.month
  )
)
async function jumpToMonth(event: Event) {
  const [year, month] = (event.target as HTMLSelectElement).value
    .split('-')
    .map(Number)
  if (!year || !month) return
  releaseTimelineSelection()
  requestedMonth = `${year}-${month}`
  await loadBucketData(year, month)
  await nextTick()
  if (requestedMonth !== `${year}-${month}`) return
  const group = timeGroups.value.find(group => group.year === year && group.month === month)
  requestedMonth = ''
  if (group) selectedDateKey.value = groupKey(group)
}

watch(
  timeGroups,
  () => {
    setTimeout(() => {
      handleScroll()
    }, 100)
  },
  { deep: true }
)

</script>

<template>
  <section class="timeline-page">
    <header class="timeline-heading">
      <h1>
        时间线 <span v-if="statistics">{{ statistics.totalCount }} 项</span>
      </h1>
      <label v-if="monthOptions.length" class="month-jump"
        ><select aria-label="跳转到月份" :value="activeTimelineMonth" @change="jumpToMonth">
          <option value="">选择月份</option>
          <option
            v-for="m in monthOptions"
            :key="`${m.year}-${m.month}`"
            :value="`${m.year}-${m.month}`"
          >
            {{ m.year }} / {{ String(m.month).padStart(2, '0') }} ·
            {{ m.count }} 项
          </option>
        </select></label
      >
    </header>
    <div class="photo-timeline-container">
      <!-- 加载中提示 -->
      <div v-if="isInitializing" class="loading-overlay">
        <div class="loading-spinner"></div>
        <div class="loading-text">加载中...</div>
      </div>

      <!-- 错误提示 -->
      <div v-if="loadingError" class="error-overlay">
        <div class="error-text">{{ loadingError }}</div>
        <button @click="initializeTimeline" class="retry-button">重试</button>
      </div>

      <div
        v-if="!isInitializing && !loadingError && statistics?.totalCount === 0"
        class="empty-state"
      >
        <p>{{ isAdminPreview ? '暂无可预览的作品。' : '暂无公开作品。普通账号仅能查看公开内容。' }}</p>
        <router-link v-if="!isAdminPreview" :to="{ name: 'Login', query: { switch: '1', redirect: '/timeline' } }">切换到管理员账号 ↗</router-link>
      </div>

      <!-- 主内容区 -->
      <div
        ref="mainContent"
        class="main-content"
        :class="{ 'is-date-seeking': selectedDateKey }"
        @scroll.passive="handleScroll"
        @wheel.passive="releaseTimelineSelection"
        @touchstart.passive="releaseTimelineSelection"
        @keydown="releaseTimelineSelection"
      >
        <div ref="photoFlow" class="photo-flow-container">
          <div
            v-for="(row, rowIndex) in layoutRows"
            :key="rowIndex"
            class="timeline-row"
          >
            <div
              v-for="{ group, photos, width } in row"
              :key="groupKey(group)"
              :data-group="groupKey(group)"
              :data-fragment="`${groupKey(group)}-${photos[0]?.photo.id ?? 'placeholder'}`"
              class="date-group"
              :style="{ width: `${width}px` }"
              :class="{
                'is-loading': group.isLoading,
                'is-placeholder': !group.isLoaded,
                'is-time-selected': selectedDateKey === groupKey(group)
              }"
            >
              <!-- 日期标题行 -->
              <div class="date-header">
                <span class="date-title" :title="group.title">{{
                  group.title
                }}</span>
                <span v-if="group.isLoading" class="loading-indicator"
                  >加载中...</span
                >
                <span
                  v-else-if="!group.isLoaded && group.estimatedCount"
                  class="estimated-count"
                >
                  约 {{ group.estimatedCount }} 张
                </span>
              </div>

              <div
                v-if="failedBuckets.has(`${group.year}-${group.month}`)"
                class="bucket-error"
                role="status"
              >
                这个月的作品暂时无法加载
                <button
                  class="archive-action"
                  @click="loadBucketData(group.year, group.month)"
                >
                  重试
                </button>
              </div>
              <!-- 图片网格或占位符 -->
              <div v-if="group.isLoaded" class="photo-grid">
                <TimelineMedia
                  v-for="{
                    photo,
                    width: photoWidth,
                    height: photoHeight
                  } in photos"
                  :key="photo.id"
                  class="photo-item"
                  :class="{
                    'is-video':
                      photo.mediaType === 'video' ||
                      photo.mediaType?.startsWith('video/')
                  }"
                  :to="mediaDetailRoute(photo)"
                  :src="photo.url"
                  :preview-src="photo.thumbnailUrl"
                  :renditions="photo.renditions"
                  :is-video="photo.mediaType === 'video' || !!photo.mediaType?.startsWith('video/')"
                  :width="photo.naturalWidth"
                  :height="photo.naturalHeight"
                  @load="(img) => handleImageLoad(img, photo)"
                  :style="{
                    width: photoWidth + 'px',
                    height: photoHeight + 'px'
                  }"
                />
              </div>

              <!-- 占位符（基于预估数量） -->
              <div
                v-else-if="
                  !group.isLoading &&
                  !failedBuckets.has(`${group.year}-${group.month}`)
                "
                class="placeholder-grid"
              >
                <div
                  class="placeholder-item"
                  v-for="i in Math.min(group.estimatedCount || 6, 12)"
                  :key="i"
                ></div>
              </div>

              <!-- 加载中骨架屏 -->
              <div v-else-if="group.isLoading" class="loading-grid">
                <div
                  class="skeleton-item"
                  v-for="i in Math.min(group.estimatedCount || 6, 12)"
                  :key="i"
                ></div>
              </div>
            </div>
          </div>
        </div>
        <div class="timeline-end-space" :style="{ height: `${timelineEndSpace}px` }" aria-hidden="true" />
      </div>

      <TimelineScrubber
        v-if="timeGroups.length > 0"
        v-model:selected-key="selectedDateKey"
        :scroller="mainContent"
        :entries="scrubberEntries"
        @seek="seekTimelineDate"
        @end-space="timelineEndSpace = $event"
        @current-date="updateCurrentTimelineMonth"
        @dragging="isScrubbing = $event"
      />
    </div>
  </section>
</template>

<style scoped>
.photo-timeline-container {
  display: flex;
  height: 100%;
  background: var(--bg);
  position: relative;
  overflow: hidden;
}

.empty-state {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
  justify-content: center;
  padding: 24px;
  color: var(--muted);
  font-size: 14px;
  text-align: center;
  z-index: 1;
}
.empty-state p {
  margin: 0;
}
.empty-state a {
  color: var(--accent);
}

/* 加载和错误状态 */
.loading-overlay,
.error-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--bg);
  z-index: 1000;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--line);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-text,
.error-text {
  margin-top: 16px;
  color: var(--text);
  font-size: 14px;
}

.retry-button {
  margin-top: 16px;
  padding: 8px 24px;
  background: var(--star-gold);
  color: var(--accent-ink);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.retry-button:hover {
  background: var(--star-gold-bright);
}

.main-content {
  flex: 1;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 20px 60px 40px 20px;
  scroll-behavior: smooth;
}

.main-content::-webkit-scrollbar {
  width: 0;
}

.photo-flow-container {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-start;
  align-content: flex-start;
}

.date-group {
  display: inline-grid;
  grid-template-rows: auto 1fr;
  vertical-align: top;
  margin-bottom: 16px;
}

.date-group.is-placeholder {
  opacity: 0.6;
}

.date-header {
  grid-row: 1;
  background: var(--surface);
  backdrop-filter: blur(20px);
  padding: 10px 12px;
  margin-bottom: 8px;
  border-bottom: 1px solid var(--line);
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 12px;
}

.date-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  letter-spacing: 0.5px;
}

.loading-indicator {
  font-size: 12px;
  color: var(--accent);
}

.estimated-count {
  font-size: 12px;
  color: var(--muted);
}

.photo-grid {
  grid-row: 2;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-content: flex-start;
}

.placeholder-grid,
.loading-grid {
  grid-row: 2;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-content: flex-start;
}

.placeholder-item {
  flex: 0 0 auto;
  background: var(--surface);
  border-radius: 0;
  width: 200px;
  height: 200px;
}

.skeleton-item {
  flex: 0 0 auto;
  background: var(--surface);
  animation: timeline-breathe 2.4s ease-in-out infinite;
  border-radius: 0;
  width: 200px;
  height: 200px;
}

@keyframes timeline-breathe {
  0%, 100% { opacity: 0.65; }
  50% { opacity: 1; }
}

.photo-item {
  display: block;
  text-decoration: none;
  flex: 0 0 auto;
  border-radius: 0;
  overflow: hidden;
  background: var(--surface);
  cursor: pointer;
  transition: opacity 0.2s;
  position: relative;
}

.photo-item:hover {
  opacity: 0.85;
}

@media (max-width: 1024px) {
  .main-content {
    padding: 20px 50px 40px 15px;
  }
}

@media (max-width: 768px) {
  .main-content {
    padding: 20px 40px 30px 10px;
  }
  .photo-grid {
    gap: 3px;
  }
  .date-title {
    font-size: 13px;
  }
}

.timeline-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.timeline-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 20px;
  height: 44px;
  border-bottom: 1px solid var(--line);
  flex-shrink: 0;
}
.timeline-heading h1 {
  font-size: 13px;
  letter-spacing: 1px;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 12px;
}
.timeline-heading h1 span {
  font: 10px var(--mono);
  letter-spacing: 1px;
  color: var(--accent-warm);
}
.month-jump {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: var(--muted);
}
.month-jump select {
  height: 40px;
  background: var(--bg);
  border: 0;
  padding: 0 8px;
  color: var(--text);
  font: 12px var(--mono);
}
.photo-timeline-container {
  flex: 1;
  min-height: 0;
  height: auto;
  background: var(--bg);
}
.main-content {
  position: relative;
  min-width: 0;
  padding: 8px 20px 24px 16px;
  scroll-behavior: auto;
}
.photo-flow-container {
  display: flex;
  flex-direction: column;
  flex-wrap: nowrap;
  align-items: stretch;
  gap: 18px;
}
.timeline-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  width: 100%;
}
.date-group {
  flex: 0 0 auto;
  margin: 0;
  min-width: 0;
  grid-template-columns: minmax(0, 1fr);
}
.date-header {
  height: 26px;
  padding: 0;
  margin-bottom: 4px;
  min-width: 0;
  background: transparent;
  backdrop-filter: none;
  border: 0;
}
.date-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--text);
}
.is-time-selected .date-title {
  color: var(--accent);
}
.is-time-selected .date-header {
  box-shadow: inset 2px 0 var(--accent);
  padding-left: 8px;
}
.is-date-seeking {
  overflow-anchor: none;
}
.timeline-end-space {
  width: 100%;
  pointer-events: none;
}
.photo-grid {
  flex-wrap: nowrap;
  gap: 4px;
}
.photo-item,
.placeholder-item,
.skeleton-item {
  max-width: 100%;
}
.photo-item {
  transition: filter 0.2s;
}
.photo-item:is(:hover, :focus-within) {
  opacity: 1;
  filter: brightness(1.1);
  outline: 1px solid var(--accent);
  outline-offset: 3px;
}
.retry-button {
  border-radius: 0;
  color: var(--accent-ink);
  min-height: 44px;
}
@media (max-width: 700px) {
  .timeline-heading {
    padding: 0 12px;
    gap: 8px;
  }
  .timeline-heading h1 span {
    font-size: 9px;
  }
  .month-jump {
    min-width: 0;
  }
  .main-content {
    padding: 6px 10px 20px 10px;
  }
  .photo-item {
    flex: 0 0 auto;
    min-width: 0;
  }
  .date-title {
    font-size: 12px;
  }
}
.bucket-error {
  padding: 24px;
  background: var(--surface);
  color: var(--muted);
  font-size: 13px;
  display: flex;
  gap: 16px;
  align-items: center;
}
.loading-overlay,
.error-overlay {
  background: var(--bg);
}
@media (prefers-reduced-motion: reduce) {
  .skeleton-item { animation: none; }
}
</style>

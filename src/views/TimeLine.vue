<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { getTimelineStatistics, getTimelineBucket, type TimelineStatistics, type TimelineBucket, type BucketPhoto, type MonthlyCount } from '../api/timeline'
import { getSystemConfig } from '../api/systemConfig'

interface Photo {
  id: string
  url: string
  date: Date
  coverUrl?: string
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
  height: number
  isLoaded: boolean
  isLoading: boolean
  estimatedCount?: number // 新增：该月预估的照片数量
}

interface TimelineSegment {
  year: number
  month: number
  day: number
  count: number
  height: number
  dateFormatted: string
  hasLabel: boolean
  hasDot: boolean
  hasYearLine?: boolean
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
const scrollBar = ref<HTMLElement>()
const isHover = ref(false)
const isDragging = ref(false)
const hoverY = ref(0)
const scrollY = ref(0)
const windowHeight = ref(window.innerHeight)
const activeSegment = ref<HTMLElement>()
const scrollPercent = ref(0)
const segmentsKey = ref(0)

// 数据加载状态
const statistics = ref<TimelineStatistics | null>(null)
const monthlyDistribution = ref<Map<string, number>>(new Map()) // key: "year-month", value: count
const loadedBuckets = ref<Map<string, TimelineBucket>>(new Map())
const isInitializing = ref(true)
const loadingError = ref<string>('')
const customDomain = ref<string>('albireo.shuumatu.com') // 默认域名

// 常量
const PADDING_TOP = 32
const PADDING_BOTTOM = 10
const MIN_YEAR_LABEL_DISTANCE = 80
const LOAD_THRESHOLD = 1000
const ESTIMATED_HEIGHT_PER_PHOTO = 34 // 估算每张照片占据的高度（200px高度 + 4px间距，考虑多列排列）

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

// 处理图片 URL
const processImageUrl = (url: string, mediaType: string): string => {
  if (mediaType && (mediaType.startsWith('video/') || mediaType === 'video')) {
    return ''
  }
  const rawPattern = /\/raw\/[^/]+$/
  if (rawPattern.test(url)) {
    return url.replace(rawPattern, '/medium/medium.jpg')
  }
  return url
}

// 处理视频 URL：将 /original/文件名 替换为 /thumbnails/thumbnail.jpg
const processVideoUrl = (url: string): string => {
  // 匹配 /original/文件名 的模式（文件名可能包含空格等特殊字符）
  const originalPattern = /\/original\/[^/]*$/
  if (originalPattern.test(url)) {
    return url.replace(originalPattern, '/thumbnails/thumbnail.jpg')
  }
  return url
}

// 计算图片显示宽度
const calculatePhotoWidth = (photo: Photo): number => {
  const FIXED_HEIGHT = 200
  if (photo.naturalWidth && photo.naturalHeight && photo.naturalHeight > 0) {
    const aspectRatio = photo.naturalWidth / photo.naturalHeight
    const calculatedWidth = Math.round(FIXED_HEIGHT * aspectRatio)
    return Math.max(100, Math.min(calculatedWidth, 400))
  }
  return 200
}

// 处理图片加载完成
const handleImageLoad = (event: Event, photo: Photo) => {
  const img = event.target as HTMLImageElement
  if (img.naturalWidth && img.naturalHeight) {
    photo.naturalWidth = img.naturalWidth
    photo.naturalHeight = img.naturalHeight
    updateGroupHeights()
    segmentsKey.value++
  }
}

const getDisplayUrl = (photo: BucketPhoto): string => {
  const isVideo = photo.mediaType && (photo.mediaType.startsWith('video/') || photo.mediaType === 'video')
  
  if (isVideo) {
    // 视频：使用 objectKey 生成缩略图 URL
    // 优先使用 coverUrl（如果存在且是完整 URL）
    if (photo.coverUrl && photo.coverUrl.startsWith('http')) {
      return photo.coverUrl
    }
    
    // 使用 objectKey 处理视频缩略图
    const raw = photo.objectKey || ''
    const processedUrl = processVideoUrl(raw)
    
    // 如果已经是完整 URL，直接返回
    if (processedUrl.startsWith('http')) {
      return processedUrl
    }
    
    // 如果 coverUrl 存在但不是完整 URL，使用 coverUrl
    if (photo.coverUrl) {
      const domain = customDomain.value.startsWith('http') ? customDomain.value : `https://${customDomain.value}`
      const normalizedCoverUrl = photo.coverUrl.startsWith('/') ? photo.coverUrl.slice(1) : photo.coverUrl
      return `${domain}/${normalizedCoverUrl}`
    }
    
    // 使用处理后的 objectKey 拼接域名
    if (processedUrl) {
      const domain = customDomain.value.startsWith('http') ? customDomain.value : `https://${customDomain.value}`
      const normalizedUrl = processedUrl.startsWith('/') ? processedUrl.slice(1) : processedUrl
      return `${domain}/${normalizedUrl}`
    }
    
    return ''
  } else {
    // 图片：使用 objectKey 处理并拼接域名
    const raw = photo.objectKey
    const processedUrl = processImageUrl(raw, photo.mediaType) || raw
    
    // 如果已经是完整 URL，直接返回
    if (processedUrl.startsWith('http')) {
      return processedUrl
    }
    
    // 拼接域名
    const domain = customDomain.value.startsWith('http') ? customDomain.value : `https://${customDomain.value}`
    const normalizedUrl = processedUrl.startsWith('/') ? processedUrl.slice(1) : processedUrl
    return `${domain}/${normalizedUrl}`
  }
}

// 根据后端返回的月份分布生成占位组
const generateMonthPlaceholders = (): TimeGroup[] => {
  if (!statistics.value || !statistics.value.monthlyDistribution) return []
  
  const groups: TimeGroup[] = []
  
  // 按时间倒序排列（从最新到最早）
  const sortedMonths = [...statistics.value.monthlyDistribution].sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year
    return b.month - a.month
  })
  
  sortedMonths.forEach(({ year, month, count }) => {
    // 为有数据的月份创建占位组
    groups.push({
      year,
      month,
      day: 15, // 使用月份中间的日期作为占位
      title: `${year}年${month}月`,
      photos: [],
      height: Math.max(200, count * ESTIMATED_HEIGHT_PER_PHOTO), // 根据照片数量估算高度
      isLoaded: false,
      isLoading: false,
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
    props.photos.forEach(photo => {
      const year = photo.date.getFullYear()
      const month = photo.date.getMonth() + 1
      const day = photo.date.getDate()
      const key = `${year}-${month}-${day}`
      if (!groups.has(key)) {
        groups.set(key, [])
      }
      groups.get(key)!.push(photo)
    })
    return Array.from(groups.entries()).map(([key, photos]) => {
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
        height: 0,
        isLoaded: true,
        isLoading: false
      }
    }).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year
      if (a.month !== b.month) return b.month - a.month
      return b.day - a.day
    })
  }
  
  // 使用智能占位
  const placeholders = generateMonthPlaceholders()
  const allGroups: TimeGroup[] = []
  
  placeholders.forEach(placeholder => {
    const bucketKey = `${placeholder.year}-${placeholder.month}`
    const bucket = loadedBuckets.value.get(bucketKey)
    
    if (bucket) {
      // 已加载数据，按天分组
      const dayGroups = new Map<number, BucketPhoto[]>()
      // 使用 bucket.media 而不是 bucket.photos，因为后端返回的字段名是 media
      const mediaList = bucket.media || []
      mediaList.forEach(photo => {
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
            photos: photos.map(p => {
              const displayUrl = getDisplayUrl(p)
              const isVideo = p.mediaType && (p.mediaType.startsWith('video/') || p.mediaType === 'video')
              
              // 预加载图片以获取尺寸
              if (!isVideo && displayUrl) {
                const img = new Image()
                img.onload = () => {
                  const photo = allGroups
                    .find(g => g.year === placeholder.year && g.month === placeholder.month && g.day === day)
                    ?.photos.find(ph => ph.id === p.uuid)
                  if (photo) {
                    photo.naturalWidth = img.naturalWidth
                    photo.naturalHeight = img.naturalHeight
                    updateGroupHeights()
                    segmentsKey.value++
                  }
                }
                img.src = displayUrl
              }
              
              return {
                id: p.uuid,
                url: displayUrl,
                date: new Date(p.createdAt),
                coverUrl: p.coverUrl === null ? undefined : p.coverUrl, // 将 null 转换为 undefined
                mediaType: p.mediaType,
                naturalWidth: isVideo ? 200 : undefined,
                naturalHeight: isVideo ? 200 : undefined
              }
            }),
            height: 0,
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

// 加载指定月份的数据
const loadBucketData = async (year: number, month: number) => {
  const bucketKey = `${year}-${month}`
  
  // 检查该月份是否有数据
  if (!monthlyDistribution.value.has(bucketKey)) {
    console.log(`月份 ${bucketKey} 没有数据，跳过加载`)
    return
  }
  
  // 如果已经加载或正在加载，跳过
  if (loadedBuckets.value.has(bucketKey)) return
  
  // 查找并标记为加载中
  const groupIndex = timeGroups.value.findIndex(
    g => g.year === year && g.month === month && !g.isLoaded
  )
  if (groupIndex !== -1) {
    timeGroups.value[groupIndex].isLoading = true
  }
  
  try {
    const bucket = await getTimelineBucket(year, month)
    loadedBuckets.value.set(bucketKey, bucket)
    
    // 触发重新计算
    segmentsKey.value++
    
    // 等待 DOM 更新后重新计算高度
    setTimeout(() => {
      updateGroupHeights()
      segmentsKey.value++
    }, 100)
  } catch (error) {
    console.error(`加载 ${year}-${month} 数据失败:`, error)
    if (groupIndex !== -1) {
      timeGroups.value[groupIndex].isLoading = false
    }
  }
}

// 检查哪些月份需要加载
const checkAndLoadVisibleBuckets = () => {
  if (!mainContent.value) return
  
  const scrollTop = mainContent.value.scrollTop
  const viewportHeight = mainContent.value.clientHeight
  
  timeGroups.value.forEach(group => {
    if (group.isLoaded || group.isLoading) return
    
    const key = `${group.year}-${group.month}-${group.day}`
    const element = document.querySelector(`[data-group="${key}"]`) as HTMLElement
    
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
    
    // 并行获取统计数据和自定义域名配置
    const [stats, domainConfig] = await Promise.all([
      getTimelineStatistics(),
      getSystemConfig('storage', 'custom_domain').catch(() => null)
    ])
    
    statistics.value = stats
    
    // 更新自定义域名
    if (domainConfig?.value) {
      customDomain.value = domainConfig.value
    }
    
    // 触发重新计算
    segmentsKey.value++
    
    // 等待 DOM 更新
    setTimeout(() => {
      updateGroupHeights()
      checkAndLoadVisibleBuckets()
      segmentsKey.value++
    }, 100)
  } catch (error) {
    console.error('加载时间轴统计数据失败:', error)
    loadingError.value = '加载失败，请刷新重试'
  } finally {
    isInitializing.value = false
  }
}

// 计算时间轴片段
const calculateSegments = (): TimelineSegment[] => {
  if (!scrollBar.value) return []
  
  const scrollBarHeight = scrollBar.value.clientHeight
  const availableHeight = scrollBarHeight - (PADDING_TOP + PADDING_BOTTOM)
  
  const totalContentHeight = timeGroups.value.reduce((sum, group) => sum + (group.height || 0), 0)
  
  // 如果没有高度信息，使用估算高度
  if (totalContentHeight === 0) {
    const segments: TimelineSegment[] = []
    let lastYear = -1
    let lastMonthKey = ''
    let verticalSpanWithoutLabel = 0
    let previousLabeledSegment: TimelineSegment | undefined
    
    timeGroups.value.forEach((group, index) => {
      const estimatedHeight = group.height || Math.max(200, (group.estimatedCount || 6) * ESTIMATED_HEIGHT_PER_PHOTO)
      const segmentHeight = (estimatedHeight / timeGroups.value.reduce((sum, g) => sum + Math.max(200, (g.estimatedCount || 6) * ESTIMATED_HEIGHT_PER_PHOTO), 0)) * availableHeight
      
      const currentMonthKey = `${group.year}-${group.month}`
      const isNewMonth = currentMonthKey !== lastMonthKey
      const isNewYear = group.year !== lastYear
      
      const segment: TimelineSegment = {
        year: group.year,
        month: group.month,
        day: group.day,
        count: group.estimatedCount || group.photos.length,
        height: segmentHeight,
        dateFormatted: group.title,
        hasLabel: false,
        hasDot: isNewMonth,
        hasYearLine: false
      }
      const isFirstSegment = index === 0
      // 年份标签和年份线逻辑
      if (isNewYear) {
        segment.hasYearLine = true
        
        if (isFirstSegment || !previousLabeledSegment || verticalSpanWithoutLabel > MIN_YEAR_LABEL_DISTANCE) {
            segment.hasLabel = true
            previousLabeledSegment = segment
            verticalSpanWithoutLabel = 0
        }
      }
      
      verticalSpanWithoutLabel += segmentHeight
      lastYear = group.year
      lastMonthKey = currentMonthKey
      segments.push(segment)
    })
    
    return segments
  }
  
  // 使用实际高度计算
  let verticalSpanWithoutLabel = 0
  let segments: TimelineSegment[] = []
  let previousLabeledSegment: TimelineSegment | undefined
  let lastMonthKey = ''
  let lastYear = -1
  
  timeGroups.value.forEach((group, index) => {
    const groupHeight = group.height || 0
    if (groupHeight === 0) return // 跳过没有高度的组
    
    const contentPercentage = groupHeight / totalContentHeight
    const segmentHeight = contentPercentage * availableHeight
    
    const currentMonthKey = `${group.year}-${group.month}`
    const isNewMonth = currentMonthKey !== lastMonthKey
    const isNewYear = group.year !== lastYear
    
    const segment: TimelineSegment = {
      year: group.year,
      month: group.month,
      day: group.day,
      count: group.photos.length || group.estimatedCount || 0,
      height: segmentHeight,
      dateFormatted: group.title,
      hasLabel: false,
      hasDot: isNewMonth,
      hasYearLine: false
    }
    const isFirstSegment = index === 0
    // 年份标签和年份线逻辑
    if (isNewYear) {
      segment.hasYearLine = true
      
      if (isFirstSegment || !previousLabeledSegment || verticalSpanWithoutLabel > MIN_YEAR_LABEL_DISTANCE) {
            segment.hasLabel = true
            previousLabeledSegment = segment
            verticalSpanWithoutLabel = 0
        }
    }
    
    verticalSpanWithoutLabel += segmentHeight
    lastYear = group.year
    lastMonthKey = currentMonthKey
    segments.push(segment)
  })
  
  return segments
}

const segments = computed(() => {
  windowHeight.value
  segmentsKey.value
  return calculateSegments()
})

const hoverLabel = computed(() => {
  return activeSegment.value?.dataset.label || ''
})

// 处理主内容滚动
const handleScroll = () => {
  if (!mainContent.value || isDragging.value) return
  const element = mainContent.value
  const scrollTop = element.scrollTop
  const scrollHeight = element.scrollHeight
  const clientHeight = element.clientHeight
  const maxScroll = scrollHeight - clientHeight
  const percent = maxScroll > 0 ? scrollTop / maxScroll : 0
  scrollPercent.value = percent
  
  const scrollBarHeight = scrollBar.value?.clientHeight || 0
  const availableHeight = scrollBarHeight - (PADDING_TOP + PADDING_BOTTOM)
  scrollY.value = percent * availableHeight
  
  checkAndLoadVisibleBuckets()
}

// 处理鼠标移动
const handleMouseMove = (event: MouseEvent) => {
  if (!scrollBar.value || !isHover.value) return
  const rect = scrollBar.value.getBoundingClientRect()
  const y = Math.max(0, Math.min(event.clientY - rect.top - PADDING_TOP, rect.height - (PADDING_TOP + PADDING_BOTTOM)))
  hoverY.value = y
  const x = rect.left + rect.width / 2
  const elements = document.elementsFromPoint(x, event.clientY)
  const segment = elements.find(el =>
    el instanceof HTMLElement && el.dataset.id === 'time-segment'
  ) as HTMLElement | undefined
  activeSegment.value = segment
}

// 处理鼠标按下
const handleMouseDown = () => {
  if (isHover.value && activeSegment.value) {
    const label = activeSegment.value.dataset.label
    if (label) {
      const targetGroup = timeGroups.value.find(group => group.title === label)
      if (targetGroup) {
        const key = `${targetGroup.year}-${targetGroup.month}-${targetGroup.day}`
        const element = document.querySelector(`[data-group="${key}"]`)
        if (element && mainContent.value) {
          const elementTop = (element as HTMLElement).offsetTop
          mainContent.value.scrollTo({
            top: elementTop - 20,
            behavior: 'smooth'
          })
        }
      }
    }
    isDragging.value = true
  }
}

// 处理拖拽滚动
const handleMouseDrag = (event: MouseEvent) => {
  if (!isDragging.value || !scrollBar.value || !mainContent.value) return
  const rect = scrollBar.value.getBoundingClientRect()
  const y = Math.max(0, Math.min(event.clientY - rect.top - PADDING_TOP, rect.height - (PADDING_TOP + PADDING_BOTTOM)))
  hoverY.value = y
  const x = rect.left + rect.width / 2
  const elements = document.elementsFromPoint(x, event.clientY)
  const segment = elements.find(el =>
    el instanceof HTMLElement && el.dataset.id === 'time-segment'
  ) as HTMLElement | undefined
  if (segment && segment !== activeSegment.value) {
    activeSegment.value = segment
    const label = segment.dataset.label
    if (label) {
      const targetGroup = timeGroups.value.find(group => group.title === label)
      if (targetGroup) {
        const key = `${targetGroup.year}-${targetGroup.month}-${targetGroup.day}`
        const element = document.querySelector(`[data-group="${key}"]`)
        if (element) {
          const elementTop = (element as HTMLElement).offsetTop
          mainContent.value.scrollTop = elementTop - 20
        }
      }
    }
  }
}

const handleMouseUp = () => {
  isDragging.value = false
}

// 更新分组高度
const updateGroupHeights = () => {
  timeGroups.value.forEach((group) => {
    const key = `${group.year}-${group.month}-${group.day}`
    const element = document.querySelector(`[data-group="${key}"]`)
    if (element) {
      const style = window.getComputedStyle(element)
      const marginBottom = parseFloat(style.marginBottom) || 0
      group.height = (element as HTMLElement).offsetHeight + marginBottom
    }
  })
}

// 生命周期
onMounted(() => {
  initializeTimeline()
  
  const handleResize = () => {
    windowHeight.value = window.innerHeight
    setTimeout(() => {
      updateGroupHeights()
      segmentsKey.value++
      handleScroll()
    }, 100)
  }
  
  window.addEventListener('resize', handleResize)
  
  if (mainContent.value) {
    mainContent.value.addEventListener('scroll', handleScroll)
  }
  
  return () => {
    window.removeEventListener('resize', handleResize)
  }
})

onUnmounted(() => {
  if (mainContent.value) {
    mainContent.value.removeEventListener('scroll', handleScroll)
  }
})

watch(timeGroups, () => {
  setTimeout(() => {
    updateGroupHeights()
    handleScroll()
    segmentsKey.value++
  }, 100)
}, { deep: true })

watch(windowHeight, () => {
  setTimeout(() => {
    updateGroupHeights()
    if (mainContent.value) {
      handleScroll()
    }
    segmentsKey.value++
  }, 50)
})
</script>

<template>
  <div class="photo-timeline-container" @mousemove="handleMouseMove" @mousedown="handleMouseDown" @mouseup="handleMouseUp">
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

    <!-- 主内容区 -->
    <div ref="mainContent" class="main-content">
      <div class="photo-flow-container">
        <div
          v-for="group in timeGroups"
          :key="`${group.year}-${group.month}-${group.day}`"
          :data-group="`${group.year}-${group.month}-${group.day}`"
          class="date-group"
          :class="{ 'is-loading': group.isLoading, 'is-placeholder': !group.isLoaded }"
        >
          <!-- 日期标题行 -->
          <div class="date-header">
            <span class="date-title">{{ group.title }}</span>
            <span v-if="group.isLoading" class="loading-indicator">加载中...</span>
            <span v-else-if="!group.isLoaded && group.estimatedCount" class="estimated-count">
              约 {{ group.estimatedCount }} 张
            </span>
          </div>
          
          <!-- 图片网格或占位符 -->
          <div v-if="group.isLoaded" class="photo-grid">
            <div
              v-for="photo in group.photos"
              :key="photo.id"
              class="photo-item"
              :class="{ 'is-video': photo.mediaType === 'video' || photo.mediaType?.startsWith('video/') }"
              :style="{ 
                width: calculatePhotoWidth(photo) + 'px', 
                height: '200px'
              }"
            >
              <img 
                :src="photo.url" 
                :alt="`照片 ${photo.id}`" 
                loading="lazy"
                @load="(e) => handleImageLoad(e, photo)"
              >
              <!-- 视频标识图标 -->
              <div v-if="photo.mediaType === 'video' || photo.mediaType?.startsWith('video/')" class="video-indicator">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="10" fill="rgba(0,0,0,0.6)"/>
                  <path d="M10 8L16 12L10 16V8Z" fill="white"/>
                </svg>
              </div>
            </div>
          </div>
          
          <!-- 占位符（基于预估数量） -->
          <div v-else-if="!group.isLoading" class="placeholder-grid">
            <div 
              class="placeholder-item" 
              v-for="i in Math.min(group.estimatedCount || 6, 12)" 
              :key="i"
            ></div>
          </div>
          
          <!-- 加载中骨架屏 -->
          <div v-else class="loading-grid">
            <div 
              class="skeleton-item" 
              v-for="i in Math.min(group.estimatedCount || 6, 12)" 
              :key="i"
            ></div>
          </div>
        </div>
      </div>
    </div>

    <!-- 时间轴滚动条 -->
    <div
      ref="scrollBar"
      class="scrubber"
      :class="{ 'is-dragging': isDragging }"
      :style="{
        paddingTop: PADDING_TOP + 'px',
        paddingBottom: PADDING_BOTTOM + 'px'
      }"
      @mouseenter="isHover = true"
      @mouseleave="isHover = false"
      @mousemove="handleMouseDrag"
    >
      <!-- 悬停标签 -->
      <div
        v-if="hoverLabel && (isHover || isDragging)"
        class="hover-label"
        :class="{ 'is-dragging': isDragging }"
        :style="{ top: hoverY + 2 + 'px' }"
      >
        {{ hoverLabel }}
      </div>

      <!-- 滚动位置指示器 -->
      <div
        v-if="!isDragging"
        class="scroll-indicator"
        :style="{ top: scrollY + PADDING_TOP - 2 + 'px' }"
      />

      <!-- 时间片段 -->
      <div
        v-for="segment in segments"
        :key="`${segment.year}-${segment.month}-${segment.day}`"
        class="time-segment"
        :data-id="'time-segment'"
        :data-label="segment.dateFormatted"
        :style="{ height: segment.height + 'px' }"
      >
        <div v-if="segment.hasYearLine" class="year-line" />
        <div v-if="segment.hasLabel" class="year-label">
          {{ segment.year }}
        </div>
        <div v-if="segment.hasDot" class="month-dot" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.photo-timeline-container {
  display: flex;
  height: 100%;
  background: #000;
  position: relative;
  overflow: hidden;
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
  background: rgba(0, 0, 0, 0.9);
  z-index: 1000;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: #007aff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text,
.error-text {
  margin-top: 16px;
  color: #fff;
  font-size: 14px;
}

.retry-button {
  margin-top: 16px;
  padding: 8px 24px;
  background: #007aff;
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.retry-button:hover {
  background: #0051d5;
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
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(20px);
  padding: 10px 12px;
  margin-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 12px;
}

.date-title {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  letter-spacing: 0.5px;
}

.loading-indicator {
  font-size: 12px;
  color: #007aff;
}

.estimated-count {
  font-size: 12px;
  color: #999;
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
  background: rgba(255, 255, 255, 0.05);
  border-radius: 0;
  width: 200px;
  height: 200px;
}

.skeleton-item {
  flex: 0 0 auto;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.05) 25%, rgba(255, 255, 255, 0.1) 50%, rgba(255, 255, 255, 0.05) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 0;
  width: 200px;
  height: 200px;
}

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.photo-item {
  flex: 0 0 auto;
  border-radius: 0;
  overflow: hidden;
  background: #111;
  cursor: pointer;
  transition: opacity 0.2s;
  position: relative;
}

.photo-item:hover {
  opacity: 0.85;
}

.photo-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.video-indicator {
  position: absolute;
  bottom: 8px;
  right: 8px;
  pointer-events: none;
  opacity: 0.9;
}

.photo-item:hover .video-indicator {
  opacity: 1;
}

.scrubber {
  position: absolute;
  right: 0;
  top: 0;
  width: 60px;
  height: 95%;
  background: transparent;
  cursor: ns-resize;
  user-select: none;
  z-index: 100;
}

.scrubber.is-dragging {
  width: 100vw;
  background: rgba(0, 0, 0, 0.5);
}

.hover-label {
  position: absolute;
  right: 0;
  min-width: 100px;
  max-width: 200px;
  width: fit-content;
  background: rgba(255, 255, 255, 0.95);
  border: 2px solid #007aff;
  border-radius: 6px 0 0 6px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  box-shadow: 0 2px 10px rgba(0,0,0,0.3);
  z-index: 1;
  pointer-events: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #000;
}

.hover-label.is-dragging {
  border-radius: 6px 0 6px 6px;
  border-bottom: 2px solid #007aff;
}

.scroll-indicator {
  position: absolute;
  right: 0;
  height: 2px;
  width: 40px;
  background: #007aff;
  box-shadow: 0 0 6px rgba(0, 122, 255, 0.6);
  z-index: 2;
}

.time-segment {
  position: relative;
}

.year-label {
  position: absolute;
  right: 16px;
  top: 0;
  font-size: 11px;
  color: #999;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.month-dot {
  position: absolute;
  right: 10px;
  top: 3px;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #d6d6d6;
}

.year-line {
  position: absolute;
  right: 0;
  top: 0;
  width: 50px;
  height: 0;
  border-top: 1px dashed rgba(255, 255, 255, 0.6);
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
  .scrubber {
    width: 40px;
  }
  .date-title {
    font-size: 13px;
  }
}
</style>
import request from '../utils/request'

/**
 * 首页推荐接口的统一卡片对象。
 * 与后端 RecommendItemVO 保持一致。
 */
export interface RecommendItemVO {
  /** image 或 video，决定前端跳转路由 */
  itemType: 'image' | 'video'
  id: number
  uuid: string
  title: string | null
  /** 缩略图直链：图片是 image_url，视频是 video_images.usage='cover' 关联的图片 image_url */
  thumbnailUrl: string | null
  shotAt: string | null
  createdAt: string
  likeCount: number
  commentCount: number
}

/**
 * 当前热门主题：基于关联视频 like_count 之和最大的标签。
 * 库内还没有 video_tags 数据时为 null。
 */
export interface TopicInfo {
  tagId: number
  tagName: string
}

/**
 * 热门推荐返回包：内容列表 + 当前热门主题元信息（前端可作副标题展示）。
 */
export interface HotRecommendVO {
  currentTopic: TopicInfo | null
  items: RecommendItemVO[]
}

/**
 * 旅途回忆卡片。一次旅途 = 一个 (年, 月, ≈50km 网格) 内拍摄的内容聚合。
 */
export interface TripVO {
  /** 形如 "2024-07_139_35"（年月_经度网格_纬度网格），仅作前端 v-for key 用 */
  tripId: string
  year: number
  month: number
  /** ISO 时间戳，最早一张照片 / 视频的 shot_at */
  startDate: string
  endDate: string
  itemCount: number
  /** 网格中心（GCJ02），用于卡片显示 + 老版 fallback 跳转 */
  centerLat: number
  centerLng: number
  /**
   * 该旅途所有媒体的真实 bbox（GCJ02）。
   * deep-link 跳转地图时优先用 fitBounds(bbox)，让视口紧贴这些媒体，
   * 避免「视口外溢」带入相邻 cell 的项导致计数对不上。
   */
  bboxMinLng: number
  bboxMinLat: number
  bboxMaxLng: number
  bboxMaxLat: number
  /** 封面图：该旅途内 like_count 最高且不为空的缩略图 */
  coverUrl: string | null
  /**
   * 反向地理编码后的简短地名，如「杭州市 · 西湖区」「日本 · 东京」。
   * 后端未配置 AMap key 或缓存未命中时为 null，前端降级显示坐标。
   */
  placeName: string | null
}

/**
 * 热门推荐（综合精选）：图片 + 视频按热度加权分排序，附带当前热门标签元信息。
 */
export function getHotRecommend(limit = 12): Promise<HotRecommendVO> {
  return request.get('/api/metadata/recommend/hot', { params: { limit } })
}

/**
 * 编辑推荐：is_featured = true 的内容随机展示。
 */
export function getFeaturedRecommend(limit = 12): Promise<RecommendItemVO[]> {
  return request.get('/api/metadata/recommend/featured', { params: { limit } })
}

/**
 * 旅途回忆：基于 PostGIS 网格 + 自然月聚类的出行卡片。
 */
export function getTripsRecommend(limit = 6): Promise<TripVO[]> {
  return request.get('/api/metadata/recommend/trips', { params: { limit } })
}

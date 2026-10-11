import request from '../utils/request'
import type { MediaRendition } from '../types/media'

/**
 * 首页推荐接口的统一卡片对象。
 * 与后端 RecommendItemVO 保持一致。
 */
export interface RecommendItemVO {
  renditions?: MediaRendition[]
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
 * 旅途回忆卡片：按自然月和 0.5° 经纬网格聚合（实际距离随纬度变化）。
 */
export interface TripVO {
  renditions?: MediaRendition[]
  /** 形如 "2024-07_139_35"（年月_经度网格_纬度网格），仅作前端 v-for key 用 */
  tripId: string
  year: number
  month: number
  /** ISO 时间戳，最早一张照片 / 视频的 shot_at */
  startDate: string
  endDate: string
  itemCount: number
  /** 网格中心（WGS84），用于卡片显示 + 老版 fallback 跳转 */
  centerLat: number
  centerLng: number
  /**
   * 该旅途所有媒体的真实 bbox（WGS84）。
   * 用于相机定位与独立的查询范围；fitBounds 的扩展视口不作为旅途筛选条件。
   * 地图按整日与范围查询，未使用固定成员 ID，不保证数量始终与卡片相等。
   */
  bboxMinLng: number
  bboxMinLat: number
  bboxMaxLng: number
  bboxMaxLat: number
  /** 封面图：该旅途内 like_count 最高且不为空的缩略图 */
  coverUrl: string | null
  /**
   * 反向地理编码后的简短地名，如「杭州市 · 西湖区」「日本 · 东京」。
   * 后端离线行政区划未命中时为 null，前端降级显示坐标。
   */
  placeName: string | null
}

/**
 * 热门推荐：图片 + 视频按热度加权分排序，附带当前热门标签元信息。
 */
export function getHotRecommend(limit = 12, signal?: AbortSignal): Promise<HotRecommendVO> {
  return request.get('/api/metadata/recommend/hot', { params: { limit }, signal })
}

/**
 * 编辑推荐：is_featured = true 的内容随机展示。
 */
export function getFeaturedRecommend(limit = 12, signal?: AbortSignal): Promise<RecommendItemVO[]> {
  return request.get('/api/metadata/recommend/featured', { params: { limit }, signal })
}

/**
 * 旅途回忆：基于 PostGIS 网格 + 自然月聚类的出行卡片。
 */
export function getTripsRecommend(limit = 6, signal?: AbortSignal): Promise<TripVO[]> {
  return request.get('/api/metadata/recommend/trips', { params: { limit }, signal })
}

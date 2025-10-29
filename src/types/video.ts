// types/video.ts

/**
 * 视频源配置
 */
export interface VideoSource {
  /** 视频URL地址 */
  src: string
  /** 清晰度标签（如：原画、1080P、720P） */
  label: string
  /** 视频MIME类型 */
  type: string
}

/**
 * 视频播放器 Props
 */
export interface VideoPlayerProps {
  /** 视频封面图URL */
  poster?: string
  /** 视频源列表（不同清晰度） */
  videoSources: VideoSource[]
}

/**
 * 视频信息（用于视频列表）
 */
export interface VideoInfo {
  /** 视频ID */
  id?: string | number
  /** 视频标题 */
  title: string
  /** 视频封面 */
  poster: string
  /** 视频源列表 */
  sources: VideoSource[]
  /** 视频时长（秒） */
  duration?: number
  /** 视频描述 */
  description?: string
}
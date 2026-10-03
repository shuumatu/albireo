/** Serializable data contract for built-in assets, CDN URLs and admin previews. */
export interface BackgroundSlide {
  /** Stable identity; keep this unchanged when sorting or replacing a photo. */
  id: string
  /** Default image URL; sufficient when no generated renditions are available. */
  src: string
  title?: string
  alt?: string
  type?: string
  width?: number
  height?: number
  /** Same full image/aspect ratio at different pixel heights, in any order. */
  sources?: readonly BackgroundSource[]
}

export interface BackgroundSource {
  height: number
  src: string
}

export interface BackgroundPlaybackOptions {
  transitionMs?: number
  hoverDelayMs?: number
  preloadNext?: boolean
  preloadDelayMs?: number
  decodeTimeoutMs?: number
  maxPixelRatio?: number
}

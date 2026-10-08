export interface MediaRendition {
  role: 'thumb' | 'medium' | 'poster'
  url: string
  width: number
  height: number
  mimeType: string
}

export interface PlaybackVariant {
  menuId?: string
  id: string
  label: string
  aliases?: string[]
  width: number
  height: number
  frameRate?: number
  bandwidth?: number
  averageBandwidth?: number
  codecs?: string
  /** A single-variant master retaining its audio group (not a video-only playlist). */
  url?: string
  available: boolean
  reason?: string
}

export interface VideoPlayback {
  authorizeUrl?: string
  masterUrl: string
  variants: PlaybackVariant[]
}

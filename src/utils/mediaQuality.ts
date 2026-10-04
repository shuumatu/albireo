import type { PlaybackVariant, VideoPlayback, MediaRendition } from '../types/media'
import type { VideoSource } from '../types/video'

export const qualityChoices = [
  { key: 'auto', label: '自动' },
  { key: 'source', label: '原画' },
  { key: '1080p', label: '1080p' },
  { key: '720p', label: '720p' },
  { key: '480p', label: '480p' }
] as const
export type QualityKey = typeof qualityChoices[number]['key']

export function variantFor(playback: VideoPlayback | undefined, key: string): PlaybackVariant | undefined {
  return playback?.variants.find(v => v.menuId === key) || playback?.variants.find(v => v.id === key || v.aliases?.includes(key) || v.label.toLowerCase() === key || (key === 'source' && v.label === '原画'))
}

export function legacyQuality(source: VideoSource): string {
  return source.label === '原画' ? 'source' : source.label.toLowerCase()
}

export function defaultLegacy(sources: VideoSource[]): string {
  return ['720p', '1080p', '480p', 'source'].find(key => sources.some(s => legacyQuality(s) === key)) || 'source'
}

/** Pixel width needed after fitting both axes. Capping DPR avoids oversized downloads. */
export function fittedImageWidth(width: number, height: number, sourceWidth: number, sourceHeight: number, fit: 'cover' | 'contain', dpr = 1): number {
  if (!(width > 0 && sourceWidth > 0 && sourceHeight > 0)) return 1
  const scale = height > 0
    ? (fit === 'cover' ? Math.max : Math.min)(width / sourceWidth, height / sourceHeight)
    : width / sourceWidth
  return Math.ceil(sourceWidth * scale * Math.min(2, Math.max(1, dpr)))
}

export function imageCandidates(renditions: MediaRendition[] | undefined, mimeType: string): MediaRendition[] {
  return (renditions || []).filter(r => r.mimeType === mimeType && r.url && r.width > 0 && r.height > 0)
    .sort((a, b) => a.width - b.width)
    .filter((r, i, all) => !i || r.width !== all[i - 1]!.width)
}

export function imageForSize(renditions: MediaRendition[] | undefined, fallback: string, width: number, height: number, fit: 'cover' | 'contain' = 'cover', dpr = 1): string {
  const candidates = imageCandidates(renditions, 'image/webp')
  if (!candidates.length) return fallback
  const reference = candidates[0]!
  const needed = fittedImageWidth(width, height, reference.width, reference.height, fit, dpr)
  return (candidates.find(r => r.width >= needed) || candidates[candidates.length - 1])!.url
}

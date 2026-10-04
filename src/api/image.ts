import request from '../utils/request'
import type { MediaRendition } from '../types/media'

export interface ImageInfoVO {
  renditions?: MediaRendition[]
  width?: number | null
  height?: number | null
  fileSize?: number | null
  mimeType?: string | null
  objectKey: string
  fileName: string
  imageUrl: string
  displayUrl?: string
  mediumUrl?: string
  thumbnailUrl?: string
  title: string | null
  description: string | null
  type: string | null
  status: string
  shotAt: string | null
  createdAt: string
}

export function getImageInfo(uuid: string): Promise<ImageInfoVO> {
  return request.get(`/api/metadata/image/info/${uuid}`)
}

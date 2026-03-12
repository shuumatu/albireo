import request from '../utils/request'

export interface ImageInfoVO {
  objectKey: string
  fileName: string
  imageUrl: string
  title: string | null
  description: string | null
  type: string | null
  status: string
  fileCreatedAt: string | null
  createdAt: string
}

export function getImageInfo(uuid: string): Promise<ImageInfoVO> {
  return request.get(`/api/metadata/image/info/${uuid}`)
}

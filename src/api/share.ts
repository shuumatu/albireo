import request from '../utils/request'

export type ShareTargetType = 'video' | 'image' | 'collection'

export interface ShareAccessVO {
  shareCode: string
  targetType: ShareTargetType
  title: string | null
  description: string | null
  needPassword: boolean
  content: any | null
}

export function getShareMeta(shareCode: string): Promise<ShareAccessVO> {
  return request.get(`/api/metadata/share/access/${shareCode}`)
}

export function accessShareWithPassword(shareCode: string, password: string): Promise<ShareAccessVO> {
  return request.post(`/api/metadata/share/access/${shareCode}`, { password })
}

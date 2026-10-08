import request from '../utils/request'

export type ShareTargetType = 'video' | 'image' | 'collection'

export interface ShareAccessVO {
  shareCode: string
  targetType: ShareTargetType
  title: string | null
  description: string | null
  needPassword: boolean
  visitToken?: string
  content: any | null
}

export function getShareMeta(shareCode: string): Promise<ShareAccessVO> {
  return request.get(`/api/metadata/share/access/${shareCode}`)
}

export function accessShareWithPassword(shareCode: string, password: string): Promise<ShareAccessVO> {
  return request.post(`/api/metadata/share/access/${shareCode}`, { password })
}

export function getShareItems(code: string, visit: string, page: number, pageSize = 50): Promise<ShareAccessVO> {
  return request.get(`/api/metadata/share/access/${code}/items`, {params: {page,pageSize},headers: {'X-Share-Visit': visit}})
}

import request from '../utils/request'
import type { LikeStatusVO, LikeTargetType, LikeToggleDTO } from '../types/like'

/**
 * 点赞 / 取消点赞（toggle）。
 * 同一目标重复请求即取消上一次操作。
 */
export function toggleLike(payload: LikeToggleDTO): Promise<LikeStatusVO> {
  return request.post('/api/metadata/like', payload)
}

/**
 * 查询某目标的点赞状态：是否已点 + 总数。
 * 未登录时 liked 始终为 false，likeCount 仍正常返回。
 */
export function getLikeStatus(targetType: LikeTargetType, targetId: string): Promise<LikeStatusVO> {
  return request.get(`/api/metadata/like/${targetType}/${targetId}`)
}

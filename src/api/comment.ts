import request from '../utils/request'
import type { CommentCreateDTO, CommentTargetType, CommentVO } from '../types/comment'

export function createComment(payload: CommentCreateDTO): Promise<CommentVO> {
  return request.post('/api/metadata/comment', payload)
}

export function getComments(targetType: CommentTargetType, targetId: string): Promise<CommentVO[]> {
  return request.get(`/api/metadata/comment/${targetType}/${targetId}`)
}

export function getCommentCount(targetType: CommentTargetType, targetId: string): Promise<number> {
  return request.get(`/api/metadata/comment/${targetType}/${targetId}/count`)
}

export function deleteComment(id: number): Promise<void> {
  return request.delete(`/api/metadata/comment/${id}`)
}

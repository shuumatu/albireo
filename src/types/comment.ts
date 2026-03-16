export type CommentTargetType = 'video' | 'image'

export interface CommentCreateDTO {
  targetType: CommentTargetType
  targetId: string
  content: string
  parentId?: number | null
}

export interface CommentVO {
  id: number
  userId: number
  username: string
  content: string
  parentId: number | null
  createdAt: string | null
  replies?: CommentVO[] | null
}

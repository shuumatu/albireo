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
  /** 该评论的点赞总数（后端冗余列） */
  likeCount: number
  /** 当前请求用户是否已点过赞（未登录恒为 false） */
  liked: boolean
}

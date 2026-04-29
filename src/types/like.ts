export type LikeTargetType = 'comment' | 'video' | 'image' | 'collection'

export interface LikeToggleDTO {
  targetType: LikeTargetType
  /** comment / collection: 数字主键转 string；video / image: UUID */
  targetId: string
}

export interface LikeStatusVO {
  liked: boolean
  likeCount: number
}

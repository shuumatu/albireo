import request from '../utils/request'
import type { RecommendItemVO } from './recommend'

/**
 * 搜索结果卡片：在 RecommendItemVO 基础上加 score 字段。
 *
 * score = 原始 cosine similarity，范围 [-1, 1]。
 * Chinese-CLIP 文本 ↔ 图像 实测几乎只在 [0.10, 0.40]，所以前端展示百分比时记得
 * 这是 cosine 而不是搜索引擎那种"相关度"。
 */
export interface SearchItemVO extends RecommendItemVO {
  score: number
}

/**
 * 文本搜索请求体。
 *
 * @see f:\code\Java\shuumatu\metadata-service\metadata-biz\src\main\java\com\shuumatu\metadataservice\controller\SearchController.java
 */
export interface TextSearchRequest {
  query: string
  /** 默认 50，上限 200 */
  limit?: number
  /** 限制返回类型，例 ['image']；不传 = 两种都搜 */
  types?: Array<'image' | 'video'>
  /** cosine similarity 下限，默认 0.22。低于此 score 的会被过滤掉 */
  minScore?: number
}

/**
 * 文本搜索：把自然语言查询喂给 embedding-service 转成向量，
 * 再走 pgvector ANN 找视觉最相关的图片+视频。
 */
export function searchByText(req: TextSearchRequest): Promise<SearchItemVO[]> {
  return request.post('/api/metadata/search/text', req)
}

/**
 * 「更多相似」：详情页底部用，以当前媒体自身的视觉向量为基准做 ANN。
 * 跨模态：图片详情页可能召回相似视频封面，反之亦然。
 *
 * @param type  'image' / 'video'
 * @param uuid  当前详情页的媒体 uuid（前端只持有 uuid，后端 resolve 成 id）
 * @param limit 默认 12，最大 50
 */
export function findSimilar(
  type: 'image' | 'video',
  uuid: string,
  limit: number = 12
): Promise<SearchItemVO[]> {
  return request.get(`/api/metadata/search/similar/${type}/${encodeURIComponent(uuid)}`, {
    params: { limit }
  })
}

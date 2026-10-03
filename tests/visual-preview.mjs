// Isolated visual QA server. No requests are forwarded to the real backend.
import { createServer } from 'vite'
const titles = ['海湾的夜色', '雪线之上', '星野记录', '冬日河岸', '山野的长夜']
const image = (i) => `/src/assets/hero/frame-${(i % 5) + 1}-1920.webp`
// Known intrinsic ratios exercise the timeline's photo and video-cover layout.
const timelineDimensions = [[960, 600], [400, 600], [400, 600], [400, 600], [960, 540], [360, 640], [900, 600], [600, 600], [1800, 400], [400, 600], [900, 600], [900, 600]]
const timelineCover = (index) => {
  const [width, height] = timelineDimensions[index]
  const colors = ['#355b71', '#58695d', '#817258', '#556077']
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="${colors[index % colors.length]}"/><path d="M0 ${height} ${width * .5} ${height * .3} ${width} ${height}Z" fill="#ffffff18"/><rect x="8" y="8" width="${width - 16}" height="${height - 16}" fill="none" stroke="#cbe0df80" stroke-width="3"/><text x="24" y="52" fill="#eff8f6" font-family="sans-serif" font-size="28">${index === 5 ? 'VIDEO' : 'PHOTO'} ${index + 1}</text><text x="24" y="90" fill="#d8e5e2" font-family="monospace" font-size="22">${width} × ${height}</text></svg>`
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}
const items = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  uuid: `preview-${i + 1}`,
  itemType: i === 5 ? 'video' : 'image',
  title: titles[i % 5],
  thumbnailUrl: image(i),
  shotAt: '2026-09-12T18:30:00',
  createdAt: '2026-09-12T18:30:00',
  likeCount: i + 2,
  commentCount: 1,
  score: 0.42 - i / 100,
  matchType: 'semantic'
}))
const detail = {
  objectKey: 'preview-image',
  fileName: 'preview.webp',
  imageUrl: image(1),
  displayUrl: image(1),
  title: '雪线之上',
  description:
    '此内容仅用于本地界面验收。远处的山峰与近处的光影，共同构成这一刻的记忆。',
  status: 'done',
  type: '摄影',
  shotAt: '2026-09-12T18:30:00',
  createdAt: '2026-09-13T09:00:00'
}
const server = await createServer({
  define: {
    'import.meta.env.VITE_API_BASE_URL': JSON.stringify('/__fixtures')
  },
  server: { host: '127.0.0.1', port: Number(process.env.VISUAL_PREVIEW_PORT || 5180), strictPort: true },
  plugins: [
    {
      name: 'isolated-visual-fixtures',
      transformIndexHtml(html) {
        return html.replace(
          '</body>',
          '<div style="position:fixed;bottom:0;left:0;z-index:99999;background:#182126;color:#b8d4df;padding:3px 9px;font:10px monospace;pointer-events:none">LOCAL UI TEST · 示例数据</div></body>'
        )
      },
      configureServer(vite) {
        vite.middlewares.use('/__fixtures', async (req, res, next) => {
          const url = new URL(req.url, 'http://localhost')
          const p = url.pathname
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          const send = (value) => res.end(JSON.stringify(value))
          if (p.includes('/recommend/featured')) return send(items)
          if (p.includes('/recommend/hot'))
            return send({
              items,
              currentTopic: { tagId: 1, tagName: '光与远方' }
            })
          if (p.includes('/recommend/trips'))
            return send([
              {
                tripId: 'preview-trip',
                year: 2026,
                month: 9,
                startDate: '2026-09-01',
                endDate: '2026-09-30',
                itemCount: 12,
                centerLat: 23.13,
                centerLng: 113.26,
                bboxMinLat: 23,
                bboxMaxLat: 24,
                bboxMinLng: 113,
                bboxMaxLng: 114,
                coverUrl: image(3),
                placeName: '旅途示例'
              }
            ])
          if (p.includes('/timeline/statistics'))
            return send({
              earliestDate: '2025-01-01',
              latestDate: '2026-09-30',
              totalCount: 36,
              monthlyDistribution: [
                { year: 2026, month: 9, count: 12 },
                { year: 2026, month: 8, count: 12 },
                { year: 2025, month: 1, count: 12 }
              ]
            })
          if (p.includes('/timeline/bucket')) {
            const year = Number(url.searchParams.get('year')),
              month = Number(url.searchParams.get('month'))
            return send({
              year,
              month,
              count: 12,
              media: items.map((x, i) => ({
                uuid: `${year}-${month}-${x.uuid}`,
                objectKey: x.uuid,
                coverUrl: timelineCover(i),
                mediaType: x.itemType,
                createdAt: `${year}-${String(month).padStart(2, '0')}-${String([23,16,16,13,10,9,9,9,9,9,9,4][i]).padStart(2, '0')}T12:00:00`
              }))
            })
          }
          if (p.includes('/image/info/')) return send(detail)
          if (p.includes('/video/info/'))
            return send({
              ...detail,
              title: '山野片刻',
              sourceUrl: null,
              coverUrl: image(4),
              tags: [{ id: 1, name: '旅途' }],
              videoVersions: []
            })
          if (p.includes('/search/similar/')) return send(items.slice(0, 5))
          if (p.includes('/search/text')) {
            let raw = ''
            for await (const chunk of req) raw += chunk
            const body = JSON.parse(raw || '{}')
            return send({
              items: body.query.includes('无结果')
                ? []
                : items.filter(
                    (x) => !body.types || body.types.includes(x.itemType)
                  ),
              mode: 'hybrid'
            })
          }
          if (p.includes('/comment/') && req.method === 'GET')
            return send(
              p.endsWith('/count')
                ? 1
                : [
                    {
                      id: 1,
                      userId: 99,
                      username: '访客示例',
                      content: '这张照片里的光很安静。',
                      createdAt: '2026-09-14T10:00:00',
                      parentId: null,
                      liked: false,
                      likeCount: 3,
                      replies: []
                    }
                  ]
            )
          if (p.includes('/map/aggregation'))
            return send({
              clusters: [],
              points: [
                {
                  uuid: 'preview-1',
                  mediaType: 'image',
                  objectKey: 'preview-1',
                  thumbnailUrl: image(0),
                  longitude: 113.26,
                  latitude: 23.13
                }
              ],
              totalVideos: 0,
              totalImages: 1,
              minTime: '2025-01-01',
              maxTime: '2026-09-30',
              timeHistogram: Array.from({ length: 32 }, (_, i) => ({
                index: i,
                start: '2025-01-01',
                count: (i % 5) + 1
              })),
              bucketCount: 32
            })
          if (p.includes('/share/access/')) {
            if (p.endsWith('/expired')) {
              res.statusCode = 404
              return send({ message: '分享已过期' })
            }
            const locked = p.endsWith('/locked') && req.method === 'GET'
            return send({
              shareCode: 'preview',
              title: '旅途中的片刻',
              description: '本地分享页布局示例',
              targetType: 'collection',
              needPassword: locked,
              content: locked
                ? null
                : {
                    collection: {
                      name: '九月影像',
                      createdAt: detail.createdAt,
                      imageUrl: image(0)
                    },
                    collectionType: 'image',
                    items: items
                      .slice(0, 5)
                      .map((x) => ({
                        ...detail,
                        id: x.id,
                        title: x.title,
                        imageUrl: x.thumbnailUrl,
                        displayUrl: x.thumbnailUrl
                      }))
                  }
            })
          }
          res.statusCode = 405
          return send({ message: '本地验收服务不执行账户或内容写入' })
        })
      }
    }
  ]
})
await server.listen()
server.printUrls()
export default server

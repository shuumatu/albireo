# GET /api/metadata/map/aggregation

地图聚合接口，返回视口内的聚合簇/散点数据，以及全局时间分布直方图。

## 请求参数（Query）

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `minLng` | number | 是 | 视口最小经度 |
| `minLat` | number | 是 | 视口最小纬度 |
| `maxLng` | number | 是 | 视口最大经度 |
| `maxLat` | number | 是 | 视口最大纬度 |
| `zoom` | number | 是 | 当前地图缩放级别（整数） |
| `startDate` | string | 否 | 时间筛选起始，格式 `yyyy-MM-dd`，包含当天（从 00:00:00 开始） |
| `endDate` | string | 否 | 时间筛选结束，格式 `yyyy-MM-dd`，包含当天（到 23:59:59 结束） |

## 响应体

```json
{
  "clusters": [
    {
      "clusterId": "cluster_35.6_139.7_z5",
      "longitude": 139.7,
      "latitude": 35.68,
      "count": 42,
      "videoCount": 15,
      "imageCount": 27,
      "representativeMediaType": "image",
      "representativeObjectKey": "media/images/2024/03/abc123/raw/photo.jpg",
      "representativeThumbnailUrl": "media/images/2024/03/abc123/medium/medium.jpg"
    }
  ],
  "points": [
    {
      "uuid": "550e8400-e29b-41d4-a716-446655440000",
      "mediaType": "video",
      "objectKey": "media/videos/2024/05/def456/original/video.mp4",
      "thumbnailUrl": "media/videos/2024/05/def456/thumbnails/thumbnail.jpg",
      "longitude": 139.75,
      "latitude": 35.66
    }
  ],
  "totalVideos": 15,
  "totalImages": 27,
  "minTime": "2022-03-15T08:30:00",
  "maxTime": "2026-01-20T16:45:00",
  "timeHistogram": [
    { "start": "2022-03-15T00:00:00", "count": 3 },
    { "start": "2022-04-01T00:00:00", "count": 0 },
    { "start": "2022-04-18T00:00:00", "count": 7 },
    { "start": "2022-05-05T00:00:00", "count": 12 },
    { "start": "2022-05-22T00:00:00", "count": 1 }
  ]
}
```

## 字段说明

### 顶层字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `clusters` | array | 聚合簇列表（高缩放级别时返回） |
| `points` | array | 散点列表（低缩放级别时返回单个媒体点） |
| `totalVideos` | number | 当前结果集中的视频总数 |
| `totalImages` | number | 当前结果集中的图片总数 |
| `minTime` | string (可选) | 全局最早的媒体拍摄/创建时间，ISO 格式。无数据时不返回 |
| `maxTime` | string (可选) | 全局最晚的媒体拍摄/创建时间，ISO 格式。无数据时不返回 |
| `timeHistogram` | array (可选) | 时间直方图桶数组，用于时间轴密度可视化。无数据时不返回 |

### `clusters[]` 聚合簇

| 字段 | 类型 | 说明 |
|------|------|------|
| `clusterId` | string | 簇的唯一标识 |
| `longitude` | number | 簇中心经度 |
| `latitude` | number | 簇中心纬度 |
| `count` | number | 簇内媒体总数 |
| `videoCount` | number | 簇内视频数量 |
| `imageCount` | number | 簇内图片数量 |
| `representativeMediaType` | string | 代表媒体的类型：`"video"` 或 `"image"` |
| `representativeObjectKey` | string | 代表媒体的存储路径 |
| `representativeThumbnailUrl` | string \| null | 代表媒体的缩略图 URL |

### `points[]` 散点

| 字段 | 类型 | 说明 |
|------|------|------|
| `uuid` | string | 媒体唯一标识 |
| `mediaType` | string | 媒体类型：`"video"` 或 `"image"` |
| `objectKey` | string | 媒体存储路径 |
| `thumbnailUrl` | string \| null | 缩略图 URL |
| `longitude` | number | 经度 |
| `latitude` | number | 纬度 |

### `timeHistogram[]` 时间直方图桶

| 字段 | 类型 | 说明 |
|------|------|------|
| `start` | string | 该桶的起始时间，ISO 格式 |
| `count` | number | 该时间段内的媒体数量（视频 + 图片） |

## timeHistogram 实现要求

1. **时间范围**：从 `minTime` 到 `maxTime`，将整个时间跨度等分为 N 个桶（建议 100~200 个）
2. **桶的划分**：每个桶覆盖 `(maxTime - minTime) / N` 的时长，`start` 为该桶的起始时间点
3. **count 统计**：统计拍摄/创建时间落在该桶范围内的媒体总数
4. **空桶保留**：count 为 0 的桶也必须返回，保证数组长度固定，前端按索引顺序绘制
5. **全局范围**：`minTime`、`maxTime`、`timeHistogram` 基于全局数据（**不受** `minLng`/`maxLng`/`startDate`/`endDate` 参数过滤），确保时间轴在地图拖拽和时间筛选时保持稳定

## 前端渲染逻辑

- `minTime` / `maxTime` 决定时间轴左右端点
- `timeHistogram` 中每个桶按顺序从左到右绘制为绿色柱条
- 柱条颜色深浅 = `count / max(所有桶的 count)`，数据越多绿色越深，count 为 0 的位置完全透明

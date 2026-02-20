import request from "../utils/request";

// 时间轴统计数据接口
interface TimelineStatistics {
  earliestDate: string; // ISO 8601 格式，例如 "2022-01-15T10:30:00Z"
  latestDate: string;   // ISO 8601 格式
  totalCount: number;   // 总资源数量
  monthlyDistribution: MonthlyCount[]; // 新增：每个月的数据量分布
}

// 月份数据量
interface MonthlyCount {
  year: number;
  month: number;
  count: number;
}

// 月份桶数据接口
interface BucketPhoto {
  uuid: string;
  objectKey: string;
  createdAt: string;      // ISO 8601 格式
  mediaType: string;
  coverUrl: string;
}

interface TimelineBucket {
  year: number;
  month: number;
  photos: BucketPhoto[];
  count: number;
}

/**
 * 获取时间轴统计信息
 * 用于初始化页面，获取最早和最晚的资源时间，以及每个月的数据分布
 */
export function getTimelineStatistics(): Promise<TimelineStatistics> {
  return request.get('/timeline/statistics');
}

/**
 * 获取指定月份的照片数据
 * @param year 年份，例如 2024
 * @param month 月份，1-12
 */
export function getTimelineBucket(year: number, month: number): Promise<TimelineBucket> {
  return request.get(`/timeline/bucket`, {
    params: { year, month }
  });
}

// 导出类型定义供其他模块使用
export type { TimelineStatistics, MonthlyCount, BucketPhoto, TimelineBucket };
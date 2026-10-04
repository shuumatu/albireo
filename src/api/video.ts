import request from "../utils/request";
import type { VideoPlayback, MediaRendition } from '../types/media';

/** 已登记版本的授权播放地址。 */
export interface VideoVersion {
  /** 例如 "1080p" / "720p" / "480p" */
  resolution: string;
  url?: string | null;
  /** "done" 表示该档已生成可播放 mp4；其它视为不可用 */
  status: string;
}

interface videoData {
  playback?: VideoPlayback;
  posterUrl?: string;
  renditions?: MediaRendition[];
  objectKey: string;
  sourceUrl?: string | null;
  title: string;
  description: string;
  coverUrl: string;
  createdAt: string;
  shotAt?: string;
  tags:Array<{ id: number; name: string }>
  /**
   * 视频已登记的所有转码版本。仅 status='done' 的对应 R2 上真实存在 mp4，
   * 前端用此过滤要不要展示 1080p / 720p / 480p 选项；老接口可能不返回此字段。
   */
  videoVersions?: VideoVersion[];
}



export function getVideoUrl(uuid:string) {
  return request.get(`/api/metadata/video/get-url/${uuid}`);
}


export function getVideoInfo(uuid:string):Promise<videoData> {
  return request.get(`/api/metadata/video/info/${uuid}`);
}

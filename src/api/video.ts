import request from "../utils/request";

/** 单个转码档位的元数据。url 由前端自行按 hash + resolution 拼接，与 worker 命名一致。 */
export interface VideoVersion {
  /** 例如 "1080p" / "720p" / "480p" */
  resolution: string;
  /** "done" 表示该档已生成可播放 mp4；其它视为不可用 */
  status: string;
}

interface videoData {
  objectKey: string;
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
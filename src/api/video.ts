import request from "../utils/request";

interface videoData {
  objectKey: string;
  title: string;
  description: string;
  coverUrl: string;
  createdAt: string;
  tags:Array<{ id: number; name: string }>
}



export function getVideoUrl(uuid:string) {
  return request.get(`/video/get-url/${uuid}`);
}


export function getVideoInfo(uuid:string):Promise<videoData> {
  return request.get(`/video/info/${uuid}`);
}
import request from "../utils/request";


export function getVideoUrl(uuid:string) {
  return request.get(`/video/get-url/${uuid}`);
}
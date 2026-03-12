import request from "../utils/request";

export interface MapPointVO {
  uuid: string;
  mediaType: "video" | "image";
  objectKey: string;
  thumbnailUrl: string | null;
  longitude: number;
  latitude: number;
}

export interface MapClusterVO {
  clusterId: string;
  longitude: number;
  latitude: number;
  count: number;
  videoCount: number;
  imageCount: number;
  representativeMediaType: "video" | "image";
  representativeObjectKey: string;
  representativeThumbnailUrl: string | null;
}

export interface MapAggregationVO {
  clusters: MapClusterVO[];
  points: MapPointVO[];
  totalVideos: number;
  totalImages: number;
}

export interface ClusterMediaPage {
  data: MapPointVO[];
  total: number;
}

export function getMapAggregation(params: {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
  zoom: number;
}): Promise<MapAggregationVO> {
  return request.get("/api/metadata/map/aggregation", { params });
}

export function getClusterMedia(
  clusterId: string,
  page = 1,
  pageSize = 20
): Promise<ClusterMediaPage> {
  return request.get(`/api/metadata/map/cluster/${encodeURIComponent(clusterId)}/media`, {
    params: { page, pageSize },
  });
}

import request from "../utils/request";

// 系统配置响应对象
interface SystemConfigVO {
  id: number;
  category: string;
  key: string;
  value: string;
  valueType: string;
  isEncrypted: boolean;
  description: string | null;
  metadata: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * 获取指定分类下的单个配置
 * @param category 配置分类（如：storage, ai_api, system）
 * @param key 配置键名
 */
export function getSystemConfig(category: string, key: string): Promise<SystemConfigVO> {
  return request.get(`/system-config/${category}/${key}`);
}

/**
 * 获取指定分类下的所有配置
 * @param category 配置分类（如：storage, ai_api, system）
 */
export function getSystemConfigsByCategory(category: string): Promise<SystemConfigVO[]> {
  return request.get(`/system-config/${category}`);
}

// 导出类型定义供其他模块使用
export type { SystemConfigVO };

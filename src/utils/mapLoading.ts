export class MapStyleError extends Error {}

export async function fetchMapStyle(
  url: string,
  apiKey: string,
  fetcher: typeof fetch = fetch,
  timeoutMs = 12000
) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetcher(url, { signal: controller.signal })
    if (!response.ok)
      throw new MapStyleError(
        `底图样式请求失败（HTTP ${response.status}），请重试`
      )
    const text = await response.text()
    let style
    try {
      style = JSON.parse(text.replace(/__PROTOMAPS_KEY__/g, apiKey))
    } catch {
      throw new MapStyleError('底图样式内容无效，请刷新页面后重试')
    }
    if (style?.version !== 8 || !style.sources || !Array.isArray(style.layers))
      throw new MapStyleError('底图样式格式不正确，请刷新页面后重试')
    return style
  } catch (error) {
    if (error instanceof MapStyleError) throw error
    throw new MapStyleError(
      controller.signal.aborted
        ? '底图样式加载超时，请重试'
        : '无法连接底图样式文件，请检查网络后重试'
    )
  } finally {
    clearTimeout(timeout)
  }
}

export function mapInitializationMessage(
  error: unknown,
  stage: 'style' | 'renderer' | 'setup'
) {
  if (error instanceof MapStyleError) return error.message
  const message = error instanceof Error ? error.message : String(error)
  if (/webgl|web gl|context.*creat|creat.*context/i.test(message))
    return '地图图形渲染启动失败，请刷新页面；若持续出现，请检查浏览器硬件加速'
  if (stage === 'renderer') return '地图渲染器启动失败，请刷新页面后重试'
  if (stage === 'style') return '底图样式加载失败，请重试'
  return '地图初始化未完成，请重试'
}

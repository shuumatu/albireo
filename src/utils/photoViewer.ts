import type { ImageInfoVO } from '../api/image'

/** displayUrl is the backend's full-resolution JPEG rendition, not its medium preview. */
export function fullSizePhotoSource(image: ImageInfoVO) {
  const mime = image.mimeType?.split(';')[0]?.trim().toLowerCase()
  const heif =
    /^image\/hei[cf](?:-sequence)?$/.test(mime || '') ||
    [image.fileName, image.objectKey, image.imageUrl].some((value) =>
      /\.hei[cf](?:[?#]|$)/i.test(value || '')
    )
  const compatible =
    heif && image.displayUrl && image.displayUrl !== image.imageUrl
  return {
    url: compatible ? image.displayUrl! : image.imageUrl,
    kind: compatible ? ('compatible' as const) : ('original' as const)
  }
}

/** Keep the same visible image area when replacing a preview with its original. */
export function upgradedZoom(
  zoom: number,
  previewWidth: number,
  originalWidth: number
) {
  return (zoom * previewWidth) / originalWidth
}

export function formatImageSize(bytes?: number | null) {
  if (!bytes || bytes < 0) return ''
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/** Resolve only after decoding, with cancellation and a bounded wait for stale URLs. */
export function decodePhoto(
  src: string,
  signal: AbortSignal,
  timeout = 25000
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    let settled = false
    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal.removeEventListener('abort', abort)
      image.onload = null
      image.onerror = null
      if (error) {
        image.src = ''
        reject(error)
      } else resolve(image)
    }
    const abort = () => finish(new DOMException('Aborted', 'AbortError'))
    const timer = window.setTimeout(
      () => finish(new Error('图片加载超时')),
      timeout
    )
    image.onload = async () => {
      try {
        await image.decode()
      } catch {
        /* Some browsers cannot decode otherwise valid images. */
      }
      if (image.naturalWidth && image.naturalHeight) finish()
      else finish(new Error('图片无法解码'))
    }
    image.onerror = () => finish(new Error('图片暂时无法加载'))
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) abort()
    else image.src = src
  })
}

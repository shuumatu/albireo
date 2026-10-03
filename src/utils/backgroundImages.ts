import type { BackgroundSlide } from '../types/background'

const positive = (value: number | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0

/** Ignore unusable/duplicate entries without mutating the API response. */
export function normalizeBackgrounds(slides: readonly BackgroundSlide[]): BackgroundSlide[] {
  const ids = new Set<string>()
  return slides.flatMap((slide) => {
    if (!slide || typeof slide.id !== 'string' || !slide.id.trim() ||
        typeof slide.src !== 'string' || !slide.src.trim() || ids.has(slide.id)) return []
    ids.add(slide.id)
    return [{
      ...slide,
      src: slide.src.trim(),
      sources: (slide.sources ?? [])
        .filter((source) => source && positive(source.height) &&
          typeof source.src === 'string' && source.src.trim())
        .map((source) => ({ ...source, src: source.src.trim() }))
        .sort((a, b) => a.height - b.height)
    }]
  })
}

// Cover is constrained by BOTH axes. Width-only thumbnails blur wide panoramas.
export function backgroundSource(
  slide: BackgroundSlide,
  width: number,
  height: number,
  pixelRatio: number,
  maxPixelRatio = 2
): string {
  if (!positive(slide.width) || !positive(slide.height) || !slide.sources?.length)
    return slide.src
  const sources = slide.sources.filter((source) => positive(source.height) && source.src)
    .slice().sort((a, b) => a.height - b.height)
  if (!sources.length) return slide.src
  const requiredHeight = Math.max(height, width * slide.height / slide.width) *
    Math.min(positive(maxPixelRatio) ? maxPixelRatio : 2, Math.max(1, pixelRatio || 1))
  return (sources.find((source) => source.height >= requiredHeight) ??
    sources[sources.length - 1])!.src
}

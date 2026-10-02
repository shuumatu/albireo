export interface TimelineLayoutItem<T> {
  photo: T
  width: number
  height: number
}

// Pack in chronological order, allowing the next date to use the previous row's space.
// A date can span several rows; each fragment retains its own date heading.
export function layoutTimeline<T, G extends { photos: T[]; isLoaded: boolean }>(
  groups: G[],
  availableWidth: number,
  targetHeight: number,
  ratioOf: (photo: T) => number
) {
  type Fragment = { group: G; photos: TimelineLayoutItem<T>[]; width: number }
  const rows: Fragment[][] = []
  const width = Math.max(1, availableWidth)
  let row: Fragment[] = []
  let used = 0
  const flush = () => {
    if (row.length) rows.push(row)
    row = []
    used = 0
  }
  for (const group of groups) {
    if (!group.isLoaded) {
      flush()
      rows.push([{ group, photos: [], width }])
      continue
    }
    for (const photo of group.photos) {
      const rawRatio = ratioOf(photo)
      const ratio = Number.isFinite(rawRatio) && rawRatio > 0 ? rawRatio : 1
      const itemWidth = Math.min(width, targetHeight * ratio)
      const height = itemWidth / ratio
      let fragment: Fragment | undefined = row[row.length - 1]
      let gap = fragment ? (fragment.group === group ? 4 : 12) : 0
      if (used + gap + itemWidth > width + 0.01) {
        flush()
        fragment = undefined
        gap = 0
      }
      if (!fragment || fragment.group !== group) {
        fragment = { group, photos: [], width: 0 }
        row.push(fragment)
      }
      fragment.width += (fragment.photos.length ? 4 : 0) + itemWidth
      fragment.photos.push({ photo, width: itemWidth, height })
      used += gap + itemWidth
    }
  }
  flush()
  return rows
}

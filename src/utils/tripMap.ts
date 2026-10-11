import type { TripVO } from '../api/recommend'

type Query = Record<string, unknown>
export type TripBounds = [[number, number], [number, number]]

function coordinate(value: unknown, limit: number): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  if (String(value).trim() === '') return null
  const number = Number(value)
  return Number.isFinite(number) && Math.abs(number) <= limit ? number : null
}

/** Keep the calendar date supplied by the API; browser timezone must not move it. */
export function tripCalendarDate(raw: unknown): string | null {
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:$|T| )/.test(raw)) return null
  const date = raw.slice(0, 10)
  const parsed = new Date(`${date}T00:00:00Z`)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return null
  if (!Number.isFinite(new Date(raw).getTime())) return null
  return date
}

export function parseTripBounds(query: Query): TripBounds | null {
  const minLng = coordinate(query.bboxMinLng, 180)
  const minLat = coordinate(query.bboxMinLat, 90)
  const maxLng = coordinate(query.bboxMaxLng, 180)
  const maxLat = coordinate(query.bboxMaxLat, 90)
  if (minLng === null || minLat === null || maxLng === null || maxLat === null) return null
  // A trip may have many photos taken at a single point or along the same latitude.
  if (minLng > maxLng || minLat > maxLat) return null
  return [[minLng, minLat], [maxLng, maxLat]]
}

/** The API and map camera both use WGS84. Keep a separate copy for the camera. */
export function tripCameraBounds(bounds: TripBounds): TripBounds {
  const [[minLng, minLat], [maxLng, maxLat]] = bounds
  return [[minLng, minLat], [maxLng, maxLat]]
}

export function parseTripCenter(query: Query): [number, number] | null {
  const lng = coordinate(query.lng, 180)
  const lat = coordinate(query.lat, 90)
  return lng === null || lat === null ? null : [lng, lat]
}

export function parseTripDates(query: Query): { startDate: string; endDate: string } | null {
  const startDate = tripCalendarDate(query.start)
  const endDate = tripCalendarDate(query.end)
  return startDate && endDate && startDate <= endDate ? { startDate, endDate } : null
}

export function tripMapRoute(trip: TripVO) {
  const query: Record<string, string | number> = {}
  const bbox = parseTripBounds(trip as unknown as Query)
  const center = parseTripCenter({ lng: trip.centerLng, lat: trip.centerLat })
  const dates = parseTripDates({ start: trip.startDate, end: trip.endDate })
  if (bbox) {
    query.bboxMinLng = bbox[0][0]
    query.bboxMinLat = bbox[0][1]
    query.bboxMaxLng = bbox[1][0]
    query.bboxMaxLat = bbox[1][1]
  }
  if (center) [query.lng, query.lat] = center
  if (dates) {
    query.start = dates.startDate
    query.end = dates.endDate
  }
  return { name: 'Map', query }
}

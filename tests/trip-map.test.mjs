import test from 'node:test'
import assert from 'node:assert/strict'
import maplibregl from 'maplibre-gl'
import { parseTripBounds, parseTripCenter, parseTripDates, tripCalendarDate, tripMapRoute, tripCameraBounds } from '../src/utils/tripMap.ts'

test('trip calendar dates retain the API day across browser timezones and accept same-day windows', () => {
  assert.equal(tripCalendarDate('2026-09-01T00:30:00+08:00'), '2026-09-01')
  assert.equal(tripCalendarDate('2026-09-30T23:30:00-08:00'), '2026-09-30')
  assert.deepEqual(parseTripDates({ start: '2026-09-01T00:30:00+08:00', end: '2026-09-01T23:30:00+08:00' }), {
    startDate: '2026-09-01', endDate: '2026-09-01'
  })
  assert.equal(tripCalendarDate('2024-02-29'), '2024-02-29')
  for (const date of ['2026-02-29', '2026-04-31', '2026-13-01', '2026-09-01oops', '', null, ['2026-09-01']]) {
    assert.equal(tripCalendarDate(date), null)
  }
  assert.equal(parseTripDates({ start: '2026-09-02', end: '2026-09-01' }), null)
  assert.equal(parseTripDates({ start: '2026-09-01' }), null)
})

test('trip bounds allow a single point or axis while rejecting incomplete, reversed and invalid coordinates', () => {
  const point = { bboxMinLng: '113.26', bboxMaxLng: '113.26', bboxMinLat: '23.13', bboxMaxLat: '23.13' }
  assert.deepEqual(parseTripBounds(point), [[113.26, 23.13], [113.26, 23.13]])
  assert.deepEqual(parseTripBounds({ ...point, bboxMaxLng: '113.3' }), [[113.26, 23.13], [113.3, 23.13]])
  assert.deepEqual(parseTripBounds({ ...point, bboxMaxLat: '23.2' }), [[113.26, 23.13], [113.26, 23.2]])
  for (const override of [
    { bboxMinLng: null }, { bboxMinLng: '' }, { bboxMinLng: ['113.26'] },
    { bboxMinLng: '113.26oops' }, { bboxMinLng: true }, { bboxMaxLng: Infinity },
    { bboxMinLng: -181 }, { bboxMaxLng: 181 }, { bboxMinLat: -91 }, { bboxMaxLat: 91 },
    { bboxMinLng: 114 }, { bboxMinLat: 24 }
  ]) assert.equal(parseTripBounds({ ...point, ...override }), null)
  assert.deepEqual(parseTripCenter({ lng: '0', lat: '0' }), [0, 0])
  assert.equal(parseTripCenter({ lng: null, lat: null }), null)
})

test('card links retain original WGS84 bounds and calendar dates and provide center fallback', () => {
  const trip = {
    bboxMinLng: 113.26, bboxMaxLng: 113.26, bboxMinLat: 23.13, bboxMaxLat: 23.13,
    centerLng: 113.26, centerLat: 23.13,
    startDate: '2026-09-01T00:30:00+08:00', endDate: '2026-09-01T23:30:00+08:00'
  }
  assert.deepEqual(tripMapRoute(trip), { name: 'Map', query: {
    bboxMinLng: 113.26, bboxMinLat: 23.13, bboxMaxLng: 113.26, bboxMaxLat: 23.13,
    lng: 113.26, lat: 23.13, start: '2026-09-01', end: '2026-09-01'
  } })
  assert.deepEqual(tripMapRoute({ ...trip, bboxMinLng: null, startDate: null, endDate: null }), {
    name: 'Map', query: { lng: 113.26, lat: 23.13 }
  })
  assert.deepEqual(tripMapRoute({}), { name: 'Map', query: {} })
})

test('same-longitude trips fit their local area instead of crossing the antimeridian', () => {
  const source = [[113.26, 23.13], [113.26, 23.2]]
  const camera = new maplibregl.LngLatBounds(tripCameraBounds(source)).adjustAntiMeridian()
  assert.ok(camera.getEast() - camera.getWest() < 0.001)
  assert.ok(camera.getNorth() - camera.getSouth() < 0.1)
  for (const point of source) assert.ok(camera.contains(point))
  assert.deepEqual(source, [[113.26, 23.13], [113.26, 23.2]])
})

test('camera bounds preserve WGS84 corners for Chinese and overseas trips', () => {
  for (const source of [
    [[113.26, 23.13], [113.26, 23.13]],
    [[113.26, 23.13], [113.3, 23.13]],
    [[113.26, 23.13], [113.3, 23.2]],
    [[126.97, 37.56], [127.01, 37.6]],
    [[105.81, 21.02], [105.85, 21.06]],
    [[139.67, 35.67], [139.71, 35.71]],
    [[2.32, 48.84], [2.36, 48.88]]
  ]) {
    const [[west, south], [east, north]] = source
    const camera = new maplibregl.LngLatBounds(tripCameraBounds(source)).adjustAntiMeridian()
    assert.deepEqual(camera.toArray(), source)
    assert.ok(camera.getEast() - camera.getWest() < 0.1)
    assert.ok(camera.getNorth() - camera.getSouth() < 0.1)
    for (const point of [[west, south], [west, north], [east, south], [east, north]]) {
      assert.ok(camera.contains(point))
    }
  }
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { layoutTimeline } from '../src/utils/timelineLayout.ts'

const day = (date, ratios) => ({
  date,
  isLoaded: true,
  photos: ratios.map((ratio, i) => ({ id: `${date}-${i}`, ratio }))
})
const pack = (groups, width, height = 200) =>
  layoutTimeline(groups, width, height, (photo) => photo.ratio)

test('different dates share a row when there is room, preserving order', () => {
  const groups = [day('23', [1.5]), day('16', [0.65, 0.65]), day('13', [0.65])]
  const rows = pack(groups, 800)
  assert.equal(rows.length, 1)
  assert.deepEqual(
    rows[0].map((fragment) => fragment.group.date),
    ['23', '16', '13']
  )
})

test('a long day wraps, and its last row accepts the next day', () => {
  const rows = pack([day('23', [1, 1, 1, 1]), day('22', [0.5])], 650)
  assert.equal(rows.length, 2)
  assert.equal(rows[0][0].photos.length, 3)
  assert.deepEqual(
    rows[1].map((fragment) => fragment.group.date),
    ['23', '22']
  )
})

test('portrait, video and panorama proportions survive narrow containers without overflow', () => {
  const groups = [day('1', [9 / 16, 16 / 9, 6, 0.2, 1.5])]
  for (const width of [268, 338, 700, 1400]) {
    const rows = pack(groups, width, width < 600 ? 150 : 200)
    const photos = rows.flatMap((row) => row.flatMap((f) => f.photos))
    assert.deepEqual(
      photos.map((p) => p.photo.id),
      groups[0].photos.map((p) => p.id)
    )
    for (const p of photos)
      assert.ok(Math.abs(p.width / p.height - p.photo.ratio) < 1e-10)
    for (const row of rows)
      assert.ok(
        row.reduce((sum, f) => sum + f.width, 0) + (row.length - 1) * 12 <=
          width + 0.01
      )
  }
})

test('unloaded months retain their place between loaded days', () => {
  const placeholder = { date: 'month', isLoaded: false, photos: [] }
  const rows = pack([day('3', [1]), placeholder, day('1', [1])], 800)
  assert.equal(rows.length, 3)
  assert.equal(rows[1][0].group, placeholder)
})

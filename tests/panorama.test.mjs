import test from 'node:test'
import assert from 'node:assert/strict'
import {
  edgeVelocity,
  horizontalOverflow,
  advancePan,
  createPanMotion
} from '../src/utils/panorama.ts'

test('center stays still, edges move in opposite directions and accelerate toward the border', () => {
  for (const x of [0.3, 0.4, 0.5, 0.6, 0.7])
    assert.equal(Math.abs(edgeVelocity(x)), 0)
  assert.ok(edgeVelocity(0.1) < 0)
  assert.ok(edgeVelocity(0.9) > 0)
  assert.ok(edgeVelocity(0.99) > edgeVelocity(0.8))
  assert.equal(edgeVelocity(0), -edgeVelocity(1))
  assert.ok(Math.abs(edgeVelocity(0.29)) >= 90)
  assert.ok(edgeVelocity(0.71) >= 90)
})

test('stationary edge hover survives an initial zero-duration frame, stops and restarts cleanly', () => {
  const state = { position: 50, velocity: 200, overflow: 1000 }
  const pending = new Map()
  let id = 0
  const motion = createPanMotion(
    () => state,
    (position) => {
      state.position = position
    },
    (callback) => {
      pending.set(++id, callback)
      return id
    },
    (key) => pending.delete(key)
  )
  const frame = (time) => {
    const callbacks = [...pending.values()]
    pending.clear()
    callbacks.forEach((callback) => callback(time))
  }
  motion.start()
  motion.start()
  assert.equal(pending.size, 1)
  frame(100)
  frame(100)
  assert.equal(pending.size, 1)
  frame(116)
  assert.ok(state.position > 50)
  motion.stop()
  const stopped = state.position
  frame(200)
  assert.equal(state.position, stopped)
  state.position = 100
  motion.start()
  frame(300)
  assert.equal(pending.size, 0)
  state.velocity = -200
  motion.start()
  frame(400)
  frame(416)
  assert.ok(state.position < 100)
  motion.stop()
})

test('cover uses the full panorama height, with no horizontal motion for portrait images', () => {
  assert.equal(horizontalOverflow(8731, 2160, 1440, 720), 1470.3333333333335)
  assert.equal(horizontalOverflow(1000, 2000, 1440, 720), 0)
  assert.equal(horizontalOverflow(0, 0, 1440, 720), 0)
  assert.equal(advancePan(50, 380, 16, 0), 50)
})

test('movement is refresh-rate independent and stops at either end', () => {
  const move = (fps) => {
    let position = 50
    for (let i = 0; i < fps; i++)
      position = advancePan(position, 380, 1000 / fps, 2000)
    return position
  }
  assert.ok(Math.abs(move(60) - move(144)) < 1e-10)
  assert.ok(Math.abs(move(60) - 69) < 1e-10)
  assert.equal(advancePan(99.9, 380, 50, 2000), 100)
  assert.equal(advancePan(0.1, -380, 50, 2000), 0)
  assert.equal(advancePan(50, 380, 10000, 2000), 50.95)
})

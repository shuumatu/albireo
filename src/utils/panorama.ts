// Speed in CSS pixels/second; entering either outer 30% starts visible movement.
export function edgeVelocity(ratio: number): number {
  const edge = Math.max(0, Math.min(1, (Math.abs(ratio - 0.5) - 0.2) / 0.3))
  if (edge <= 1e-8) return 0
  return Math.sign(ratio - 0.5) * (90 + edge * edge * 330)
}

export function createPanMotion(
  read: () => { position: number; velocity: number; overflow: number },
  write: (position: number) => void,
  requestFrame: (callback: (time: number) => void) => number,
  cancelFrame: (id: number) => void
) {
  let frame: number | null = null
  let lastTime: number | null = null
  function stop() {
    if (frame !== null) cancelFrame(frame)
    frame = null
    lastTime = null
  }
  function tick(time: number) {
    frame = null
    const { position, velocity, overflow } = read()
    if (
      !velocity ||
      overflow <= 0 ||
      (position <= 0 && velocity < 0) ||
      (position >= 100 && velocity > 0)
    ) {
      stop()
      return
    }
    // Start the clock inside RAF. Its first timestamp can precede the pointer event.
    const elapsed = lastTime === null ? 0 : time - lastTime
    lastTime = time
    const next = advancePan(position, velocity, elapsed, overflow)
    if (next !== position) write(next)
    frame = requestFrame(tick)
  }
  return {
    start() {
      if (frame !== null) return
      lastTime = null
      frame = requestFrame(tick)
    },
    stop
  }
}

export function horizontalOverflow(
  imageWidth: number,
  imageHeight: number,
  width: number,
  height: number
): number {
  if (imageHeight <= 0 || width <= 0 || height <= 0) return 0
  return Math.max(0, (imageWidth * height) / imageHeight - width)
}

export function advancePan(
  position: number,
  pixelsPerSecond: number,
  elapsedMs: number,
  overflow: number
): number {
  if (overflow <= 0) return position
  // Cap long frames so a suspended tab cannot jump across the panorama.
  const distance =
    (pixelsPerSecond * Math.max(0, Math.min(50, elapsedMs))) / 1000
  return Math.max(0, Math.min(100, position + (distance / overflow) * 100))
}

type Sample = {
  event: string
  elapsedMs: number
  time: number
  bufferedSeconds: number
  bandwidth?: number
  systemBandwidth?: number
  width: number
  height: number
  selection: string
  pixelRatio: number
}
type Session = {
  id: number
  sourceToFirstFrameMs?: number
  playToFirstFrameMs?: number
  rebufferCount: number
  rebufferMs: number
  samples: Sample[]
}
type DiagnosticsWindow = Window & { albireoMediaDiagnostics?: { snapshot(): Session[] } }
const sessions: Session[] = []
let nextId = 0

/** Opt-in only. Deliberately accepts numeric playback facts, never a player/URL/event object. */
export function createPlaybackDiagnostics() {
  let enabled = import.meta.env.VITE_MEDIA_DIAGNOSTICS === 'true'
  try { enabled ||= import.meta.env.DEV && sessionStorage.getItem('albireo.mediaDiagnostics') === '1' } catch { /* No storage. */ }
  if (!enabled) return undefined
  const startedAt = performance.now()
  let playAt: number | undefined
  let waitAt: number | undefined
  const session: Session = { id: ++nextId, rebufferCount: 0, rebufferMs: 0, samples: [] }
  sessions.push(session)
  if (sessions.length > 4) sessions.shift()
  ;(window as DiagnosticsWindow).albireoMediaDiagnostics = { snapshot: () => JSON.parse(JSON.stringify(sessions)) }
  function endWait() {
    if (waitAt !== undefined) { session.rebufferMs += Math.round(performance.now() - waitAt); waitAt = undefined }
  }
  return {
    sample(sample: Omit<Sample, 'elapsedMs'>) {
      session.samples.push({ ...sample, elapsedMs: Math.round(performance.now() - startedAt) })
      if (session.samples.length > 120) session.samples.shift()
    },
    play() { playAt ??= performance.now() },
    firstFrame() {
      if (session.sourceToFirstFrameMs === undefined) {
        const now = performance.now()
        session.sourceToFirstFrameMs = Math.round(now - startedAt)
        if (playAt !== undefined) session.playToFirstFrameMs = Math.round(now - playAt)
      }
      endWait()
    },
    waiting() {
      if (session.sourceToFirstFrameMs === undefined || waitAt !== undefined) return
      waitAt = performance.now(); session.rebufferCount++
    },
    endWait
  }
}

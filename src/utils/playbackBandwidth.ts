/** Short lived, tab-local measurements. No media paths, tokens or account IDs are stored. */
export const BANDWIDTH_MEMORY_KEY = 'albireo.playbackBandwidth.v1'
export const BANDWIDTH_TTL_MS = 10 * 60 * 1000
export const DEFAULT_STARTUP_BANDWIDTH = 4194304
const MAX_STARTUP_BANDWIDTH = 20_000_000
type Measurement = { origin: string; network: string; measuredAt: number; bandwidth: number }
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
export type NetworkConnection = EventTarget & { type?: string; effectiveType?: string; saveData?: boolean }

export function connectionInfo(): NetworkConnection | undefined {
  return (navigator as Navigator & { connection?: NetworkConnection }).connection
}

export function networkFingerprint(connection = connectionInfo()): string {
  return [connection?.type || 'unknown', connection?.effectiveType || 'unknown', connection?.saveData ? 'save' : 'normal'].join(':')
}

export function cappedPixelRatio(dpr: number): number {
  return Number.isFinite(dpr) ? Math.min(2, Math.max(1, dpr)) : 1
}

export function mediaOrigin(url: string, pageUrl: string): string | undefined {
  try {
    const parsed = new URL(url, pageUrl)
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.origin : undefined
  } catch { return undefined }
}

/** Dependency arguments keep expiry, different origins, and network resets testable. */
export function createBandwidthMemory(storage: Store | undefined, now = Date.now) {
  function entries(): Measurement[] {
    try {
      const value: unknown = JSON.parse(storage?.getItem(BANDWIDTH_MEMORY_KEY) || '[]')
      if (!Array.isArray(value)) return []
      return value.filter((entry): entry is Measurement => typeof entry?.origin === 'string' &&
        typeof entry.network === 'string' && Number.isFinite(entry.measuredAt) &&
        now() >= entry.measuredAt && now() - entry.measuredAt < BANDWIDTH_TTL_MS &&
        Number.isFinite(entry.bandwidth) && entry.bandwidth >= 64_000 && entry.bandwidth <= 100_000_000)
    } catch { return [] }
  }
  return {
    read(origin: string | undefined, network: string): number | undefined {
      const saved = entries().find(entry => entry.origin === origin && entry.network === network)
      return saved ? Math.min(MAX_STARTUP_BANDWIDTH, Math.floor(saved.bandwidth * 0.8)) : undefined
    },
    record(origin: string | undefined, network: string, bandwidth: number) {
      if (!origin || !Number.isFinite(bandwidth) || bandwidth < 64_000) return
      const previous = entries().filter(entry => entry.origin !== origin)
      // A current segment is more useful than an old estimate after a network slowdown.
      previous.push({ origin, network, measuredAt: now(), bandwidth: Math.min(100_000_000, bandwidth) })
      try { storage?.setItem(BANDWIDTH_MEMORY_KEY, JSON.stringify(previous.slice(-8))) } catch { /* Private mode/quota: use ordinary ABR. */ }
    },
    reset() { try { storage?.removeItem(BANDWIDTH_MEMORY_KEY) } catch { /* Storage may be disabled. */ } }
  }
}

let tabMemory: ReturnType<typeof createBandwidthMemory> | undefined
export function browserBandwidthMemory() {
  if (tabMemory) return tabMemory
  let storage: Storage | undefined
  try { storage = window.sessionStorage } catch { /* Storage may be disabled. */ }
  const memory = tabMemory = createBandwidthMemory(storage)
  // Keep invalidation alive between video pages, when no player is mounted.
  const reset = () => memory.reset()
  connectionInfo()?.addEventListener('change', reset)
  window.addEventListener('online', reset)
  window.addEventListener('offline', reset)
  return memory
}

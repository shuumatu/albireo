export type VhsPlaylist = { id?: string; disabled?: boolean; excludeUntil?: number }
export type VhsRepresentation = { id: string; width: number; height: number; playlist?: VhsPlaylist; enabled(value?: boolean): boolean }
export type VhsStats = { mediaBytesTransferred?: number; mediaRequests?: number; mediaRequestsErrored?: number; mediaRequestsTimedout?: number }
export type VhsHandler = {
  representations(): VhsRepresentation[]
  bandwidth: number
  systemBandwidth: number
  customPixelRatio: number
  stats?: VhsStats
  /** Isolated compatibility adapter for VHS 3.17.x. No internal call sites elsewhere. */
  playlistController_?: {
    checkABR_?: (reason?: string) => void
    media?: () => VhsPlaylist | undefined
    fastQualityChange_?: (playlist?: VhsPlaylist) => void
  }
}

export function createQualityPolicy() {
  let signature = ''
  let previousMode = 'auto'
  let handler: VhsHandler | undefined
  let pending: ReturnType<typeof setTimeout> | undefined
  function cancel() { clearTimeout(pending); pending = undefined }
  function reselect(vhs: VhsHandler) {
    cancel()
    const controller = vhs.playlistController_
    if (!controller?.checkABR_) return
    controller.checkABR_('auto-quality')
  }
  return {
    apply(vhs: VhsHandler, mode: string, accepts: (representation: VhsRepresentation) => boolean): boolean {
      const reps = typeof vhs.representations === 'function' ? vhs.representations() : []
      const allowed = reps.filter(accepts)
      if (!allowed.length) return false
      if (handler !== vhs) { signature = ''; previousMode = 'auto'; handler = vhs; cancel() }
      const nextSignature = `${mode}:${allowed.map(rep => rep.id).sort().join('|')}`
      if (signature === nextSignature) return true
      const returningToAuto = mode === 'auto' && previousMode !== 'auto'
      signature = nextSignature; previousMode = mode
      cancel()
      const controller = vhs.playlistController_
      if (mode === 'auto' && controller?.checkABR_ && reps.every(rep => rep.playlist && typeof rep.playlist === 'object')) {
        // enabled(true) triggers a destructive fast switch for EACH re-enabled rendition.
        // Batch only the manual disabled flags; keep VHS error exclusions intact.
        const setAllowed = (candidates: VhsRepresentation[]) => reps.forEach(rep => {
          if (candidates.includes(rep)) delete rep.playlist!.disabled
          else rep.playlist!.disabled = true
        })
        const current = controller.media?.()
        const currentRep = allowed.find(rep => rep.playlist === current || (current?.id && rep.id === current.id))
        if (returningToAuto && current && currentRep && controller.fastQualityChange_) {
          // VHS 3.17 has a 100ms debounced fast switch with no cancel API. Replace a
          // pending manual selection by current/no-op. Keep that rendition alone
          // during cancellation so a concurrent bandwidth event cannot first move
          // ABR elsewhere and turn the captured current playlist into a fast switch.
          setAllowed([currentRep])
          controller.fastQualityChange_(current)
          pending = setTimeout(() => {
            pending = undefined
            setAllowed(allowed)
            controller.checkABR_?.('auto-quality')
          }, 125)
        } else { setAllowed(allowed); reselect(vhs) }
      } else {
        // Public API fallback for other VHS versions; playback still works even if
        // the optional internal batching adapter becomes unavailable.
        allowed.forEach(rep => { if (!rep.enabled()) rep.enabled(true) })
        if (mode !== 'auto') {
          // Selecting a rendition already allowed by AUTO must still take effect,
          // even when the whole short clip has buffered and no bandwidth event remains.
          const destination = allowed[0]!
          destination.enabled(false); destination.enabled(true)
        }
        reps.filter(rep => !allowed.includes(rep)).forEach(rep => rep.enabled(false))
      }
      return true
    },
    // A pending AUTO handoff restores the complete set before reselecting.
    reselect(vhs: VhsHandler) { if (!pending) reselect(vhs) },
    reset() { cancel(); signature = ''; previousMode = 'auto'; handler = undefined },
    dispose: cancel
  }
}

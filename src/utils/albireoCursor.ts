import type { AlbireoCursorState } from './albireoCursorRenderer'

export interface CursorAppearance {
  state: AlbireoCursorState
  rotation: number
}

const states = new Set<AlbireoCursorState>([
  'default', 'hover', 'text', 'precision', 'working', 'busy', 'move', 'resize', 'blocked', 'zoom-in', 'zoom-out'
])
const editable = 'textarea,input:not([type]),input[type="text"],input[type="search"],input[type="email"],input[type="url"],input[type="password"],input[type="tel"],input[type="number"],[contenteditable]:not([contenteditable="false"])'

/** Resolve the original cursor semantics supplied by the separate style mirror. */
export function resolveAlbireoCursor(element: Element, nativeCursor: string): CursorAppearance | null {
  const override = element.closest('[data-albireo-cursor]')?.getAttribute('data-albireo-cursor')
  if (override === 'native' || nativeCursor === 'none') return null
  if (override && states.has(override as AlbireoCursorState)) {
    return { state: override as AlbireoCursorState, rotation: 0 }
  }
  if (element.closest('[aria-busy="true"],.n-button--loading')) return { state: 'working', rotation: 0 }
  if (element.closest(':disabled,[aria-disabled="true"],.n-button--disabled')) return { state: 'blocked', rotation: 0 }

  // Video.js seek/volume controls and native ranges use pointer/auto in their
  // CSS, but their interaction is a directional drag rather than a link.
  const slider = element.closest('[role="slider"],[role="scrollbar"],input[type="range"]')
  if (slider) {
    const vertical = slider.getAttribute('aria-orientation') === 'vertical'
      || slider.classList.contains('vjs-slider-vertical')
    return { state: 'resize', rotation: vertical ? -Math.PI / 4 : Math.PI / 4 }
  }

  switch (nativeCursor) {
    case 'wait': return { state: 'busy', rotation: 0 }
    case 'progress': return { state: 'working', rotation: 0 }
    case 'not-allowed':
    case 'no-drop': return { state: 'blocked', rotation: 0 }
    case 'crosshair':
    case 'cell': return { state: 'precision', rotation: 0 }
    case 'move':
    case 'all-scroll':
    case 'grab':
    case 'grabbing': return { state: 'move', rotation: 0 }
    case 'text': return { state: 'text', rotation: 0 }
    case 'vertical-text': return { state: 'text', rotation: Math.PI / 2 }
    case 'pointer':
    case 'help':
    case 'copy':
    case 'alias':
    case 'context-menu': return { state: 'hover', rotation: 0 }
    case 'zoom-in':
    case 'zoom-out': return { state: nativeCursor, rotation: 0 }
  }
  if (nativeCursor.endsWith('-resize')) {
    const direction = nativeCursor.replace('-resize', '')
    const rotation = ['n', 's', 'ns', 'row'].includes(direction) ? -Math.PI / 4
      : ['e', 'w', 'ew', 'col'].includes(direction) ? Math.PI / 4
      : ['nw', 'se', 'nwse'].includes(direction) ? Math.PI / 2 : 0
    return { state: 'resize', rotation }
  }
  if (element.closest(editable)) return { state: 'text', rotation: 0 }
  if (element.closest('a[href],button,[role="button"],[role="link"],summary,select,input[type="file"],input[type="color"]')) return { state: 'hover', rotation: 0 }
  return { state: 'default', rotation: 0 }
}

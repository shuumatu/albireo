import '../styles/albireo-scrollbars.css'

type Axis = 'horizontal' | 'vertical'
type Entry = { element: HTMLElement; originalId: string; bars: HTMLDivElement[] }
const OWN = '.albireo-scrollbars'
const MANAGED = 'data-albireo-scrollable'
let nextId = 0

/** DOM thumbs change native scroll positions; wheel, touch and restoration stay native. */
export function createAlbireoScrollbars() {
  const root = document.documentElement
  const layer = document.createElement('div')
  layer.className = 'albireo-scrollbars'
  document.body.append(layer)
  const entries = new Map<HTMLElement, Entry>()
  let frame = 0, disposed = false
  let drag: { bar: HTMLDivElement; element: HTMLElement; axis: Axis; pointer: number; start: number; offset: number; ratio: number; rtl: boolean } | undefined
  const resize = new ResizeObserver(schedule)

  function scrollValue(element: HTMLElement, axis: Axis) {
    return axis === 'vertical' ? element.scrollTop : Math.abs(element.scrollLeft)
  }
  function setScroll(element: HTMLElement, axis: Axis, value: number) {
    const rtl = axis === 'horizontal' && getComputedStyle(element).direction === 'rtl'
    element.scrollTo({ [axis === 'vertical' ? 'top' : 'left']: rtl ? -value : value, behavior: 'instant' })
  }
  function endDrag() {
    const previous = drag
    drag = undefined
    if (previous) {
      previous.bar.classList.remove('is-dragging')
      if (previous.bar.hasPointerCapture(previous.pointer)) previous.bar.releasePointerCapture(previous.pointer)
    }
  }
  function makeBar(element: HTMLElement, axis: Axis) {
    const bar = document.createElement('div')
    bar.className = `albireo-scrollbar is-${axis}`
    bar.setAttribute('role', 'scrollbar')
    bar.setAttribute('aria-label', axis === 'horizontal' ? '水平滚动' : '垂直滚动')
    bar.setAttribute('aria-orientation', axis)
    bar.setAttribute('aria-controls', element.id)
    bar.setAttribute('aria-valuemin', '0')
    bar.tabIndex = 0
    const thumb = document.createElement('div')
    thumb.className = 'albireo-scrollbar-thumb'
    bar.append(thumb)
    bar.addEventListener('pointerdown', e => {
      if (e.button !== 0) return
      e.preventDefault()
      const rect = bar.getBoundingClientRect(), thumbRect = thumb.getBoundingClientRect()
      const vertical = axis === 'vertical'
      const length = vertical ? rect.height : rect.width
      const thumbLength = vertical ? thumbRect.height : thumbRect.width
      const max = vertical ? element.scrollHeight - element.clientHeight : element.scrollWidth - element.clientWidth
      const pointer = vertical ? e.clientY : e.clientX
      const rtl = !vertical && getComputedStyle(element).direction === 'rtl'
      if (e.target !== thumb) {
        const fraction = (pointer - (vertical ? rect.top : rect.left) - thumbLength / 2) / Math.max(1, length - thumbLength)
        setScroll(element, axis, max * (rtl ? 1 - fraction : fraction))
      }
      drag = { bar, element, axis, pointer: e.pointerId, start: pointer, offset: scrollValue(element, axis), ratio: max / Math.max(1, length - thumbLength), rtl }
      bar.classList.add('is-dragging')
      bar.setPointerCapture(e.pointerId)
      schedule()
    })
    bar.addEventListener('pointermove', e => {
      if (!drag || drag.bar !== bar || drag.pointer !== e.pointerId) return
      const delta = (axis === 'vertical' ? e.clientY : e.clientX) - drag.start
      setScroll(element, axis, drag.offset + delta * drag.ratio * (drag.rtl ? -1 : 1))
      schedule()
    })
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) bar.addEventListener(name, endDrag)
    bar.addEventListener('keydown', e => {
      const max = axis === 'vertical' ? element.scrollHeight - element.clientHeight : element.scrollWidth - element.clientWidth
      const page = (axis === 'vertical' ? element.clientHeight : element.clientWidth) * .9
      const current = scrollValue(element, axis)
      const values: Record<string, number> = { Home: 0, End: max, PageUp: current - page, PageDown: current + page,
        ArrowUp: current - 40, ArrowDown: current + 40, ArrowLeft: current - 40, ArrowRight: current + 40 }
      if (e.key in values) { e.preventDefault(); setScroll(element, axis, values[e.key]!); schedule() }
    })
    bar.addEventListener('wheel', e => {
      e.preventDefault()
      const amount = (axis === 'horizontal' ? e.deltaX || e.deltaY : e.deltaY) * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? element.clientHeight : 1)
      setScroll(element, axis, scrollValue(element, axis) + amount)
    }, { passive: false })
    layer.append(bar)
    return bar
  }
  function register(element: HTMLElement) {
    if (entries.has(element) || element.closest(OWN) || element === document.body) return
    const style = getComputedStyle(element)
    if (element !== root) {
      if (!/auto|scroll/.test(`${style.overflowX} ${style.overflowY}`)) return
      // Existing intentionally hidden bars (timeline, maps, NScrollbar) already
      // have their own navigation. Do not add a duplicate rail.
      if (style.scrollbarWidth === 'none' || getComputedStyle(element, '::-webkit-scrollbar').width === '0px') return
    }
    const originalId = element.id
    if (!element.id) element.id = `albireo-scroll-region-${++nextId}`
    const entry: Entry = { element, originalId, bars: [makeBar(element, 'horizontal'), makeBar(element, 'vertical')] }
    entries.set(element, entry)
    element.setAttribute(MANAGED, '')
    resize.observe(element)
    for (const child of element.children) if (!child.matches(OWN)) resize.observe(child)
  }
  function inspect(node: Element) {
    if (node.closest(OWN) || node.closest('head')) return
    if (node instanceof HTMLElement) register(node)
    for (const child of node.querySelectorAll<HTMLElement>('*')) register(child)
  }
  function remove(entry: Entry) {
    if (drag?.element === entry.element) endDrag()
    entry.element.removeAttribute(MANAGED)
    if (!entry.originalId) entry.element.removeAttribute('id')
    resize.unobserve(entry.element)
    for (const child of entry.element.children) resize.unobserve(child)
    entry.bars.forEach(bar => bar.remove())
    entries.delete(entry.element)
  }
  function measure() {
    frame = 0
    for (const entry of entries.values()) {
      const element = entry.element
      if (!element.isConnected) { remove(entry); continue }
      const viewport = element === root
      const style = getComputedStyle(element)
      const bodyStyle = getComputedStyle(document.body)
      const rect = viewport ? { left: 0, top: 0, width: innerWidth, height: innerHeight, right: innerWidth, bottom: innerHeight } : element.getBoundingClientRect()
      let left = rect.left + (viewport ? 0 : element.clientLeft), top = rect.top + (viewport ? 0 : element.clientTop)
      let right = Math.min(innerWidth, left + element.clientWidth), bottom = Math.min(innerHeight, top + element.clientHeight)
      if (!viewport) {
        for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
          const clipping = getComputedStyle(parent)
          const bounds = parent.getBoundingClientRect()
          if (/auto|scroll|hidden|clip/.test(clipping.overflowX)) { left = Math.max(left, bounds.left); right = Math.min(right, bounds.right) }
          if (/auto|scroll|hidden|clip/.test(clipping.overflowY)) { top = Math.max(top, bounds.top); bottom = Math.min(bottom, bounds.bottom) }
        }
      }
      left = Math.max(0, left); top = Math.max(0, top)
      const maxX = element.scrollWidth - element.clientWidth, maxY = element.scrollHeight - element.clientHeight
      const full = document.fullscreenElement
      const shown = rect.width > 0 && rect.height > 0 && right > left && bottom > top && (!full || full.contains(element))
      const showX = shown && maxX > 1 && (viewport ? !/hidden|clip/.test(`${style.overflowX} ${bodyStyle.overflowX}`) : /auto|scroll/.test(style.overflowX))
      const showY = shown && maxY > 1 && (viewport ? !/hidden|clip/.test(`${style.overflowY} ${bodyStyle.overflowY}`) : /auto|scroll/.test(style.overflowY))
      entry.bars.forEach((bar, i) => {
        const vertical = i === 1, show = vertical ? showY : showX
        bar.hidden = !show
        if (!show) return
        const length = (vertical ? bottom - top : right - left) - ((vertical ? showX : showY) ? 12 : 0)
        const client = vertical ? element.clientHeight : element.clientWidth
        const total = vertical ? element.scrollHeight : element.scrollWidth
        const max = vertical ? maxY : maxX
        const thumbLength = Math.min(length, Math.max(28, length * client / total))
        const value = Math.min(max, scrollValue(element, vertical ? 'vertical' : 'horizontal'))
        const fraction = value / max
        const offset = (length - thumbLength) * (!vertical && style.direction === 'rtl' ? 1 - fraction : fraction)
        bar.style.cssText = vertical ? `left:${right - 12}px;top:${top}px;width:12px;height:${length}px` : `left:${left}px;top:${bottom - 12}px;width:${length}px;height:12px`
        const thumb = bar.firstElementChild as HTMLElement
        thumb.style.cssText = vertical ? `height:${thumbLength}px;transform:translateY(${offset}px)` : `width:${thumbLength}px;transform:translateX(${offset}px)`
        bar.setAttribute('aria-valuemax', String(Math.round(max)))
        bar.setAttribute('aria-valuenow', String(Math.round(value)))
      })
    }
  }
  function schedule() { if (!disposed && !frame) frame = requestAnimationFrame(measure) }
  const mutation = new MutationObserver(records => {
    let changed = false
    for (const record of records) {
      if (record.target instanceof Element && record.target.closest(OWN)) continue
      changed = true
      if (record.type === 'attributes' && record.target instanceof HTMLElement) register(record.target)
      for (const node of record.addedNodes) if (node instanceof Element) {
        inspect(node)
        if (node.parentElement && entries.has(node.parentElement)) resize.observe(node)
      }
    }
    if (changed) schedule()
  })
  register(root)
  inspect(document.body)
  resize.observe(document.body)
  mutation.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class'] })
  mutation.observe(root, { attributes: true, attributeFilter: ['style', 'class'] })
  document.addEventListener('scroll', schedule, true)
  window.addEventListener('resize', schedule)
  window.addEventListener('blur', endDrag)
  measure()
  return {
    refresh() {
      const parent = document.fullscreenElement ?? document.body
      if (parent !== layer.parentElement && !parent.matches('video,audio')) parent.append(layer)
      schedule()
    },
    dispose() {
      disposed = true
      endDrag(); cancelAnimationFrame(frame)
      mutation.disconnect(); resize.disconnect()
      document.removeEventListener('scroll', schedule, true)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('blur', endDrag)
      for (const entry of entries.values()) remove(entry)
      layer.remove()
    }
  }
}

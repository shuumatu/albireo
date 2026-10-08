// Preserve the site's CSS cursor cascade in a separate inherited property.
// This lets the overlay read pointer/grab/text without ever uncovering the OS
// cursor just to call getComputedStyle (which flickers on Windows).
const SOURCE = '--albireo-source-cursor'

export function createCursorStyleMirror(onChange: () => void) {
  const mirror = document.createElement('style')
  mirror.dataset.albireoCursorMirror = ''

  function rules(list: CSSRuleList): string {
    return Array.from(list).map(rule => {
      if (rule instanceof CSSStyleRule) {
        const value = rule.style.getPropertyValue('cursor')
        if (!value || rule.selectorText.includes('data-albireo-cursor-active')) return ''
        const important = rule.style.getPropertyPriority('cursor') ? ' !important' : ''
        return `${rule.selectorText}{${SOURCE}:${value}${important};}`
      }
      if (rule instanceof CSSImportRule) {
        try {
          const content = rule.styleSheet ? rules(rule.styleSheet.cssRules) : ''
          return rule.media.mediaText ? `@media ${rule.media.mediaText}{${content}}` : content
        } catch { return '' }
      }
      if ('cssRules' in rule) {
        const content = rules((rule as CSSGroupingRule).cssRules)
        return content ? `${rule.cssText.slice(0, rule.cssText.indexOf('{'))}{${content}}` : ''
      }
      return ''
    }).join('\n')
  }

  function refresh() {
    const css = Array.from(document.styleSheets).filter(sheet => sheet.ownerNode !== mirror && !sheet.disabled).map(sheet => {
      try {
        const content = rules(sheet.cssRules)
        return sheet.media.mediaText ? `@media ${sheet.media.mediaText}{${content}}` : content
      } catch {
        // Cross-origin sheets may be opaque; semantic and inline hints still work.
        return ''
      }
    }).join('\n')
    if (mirror.textContent !== css) {
      mirror.textContent = css
      onChange()
    }
  }

  function sourceNode(node: Node): boolean {
    const element = node instanceof Element ? node : node.parentElement
    if (!element || element === mirror || element.closest('style') === mirror) return false
    return element.matches('style,link[rel="stylesheet"]') || Boolean(element.closest('style'))
  }
  const observer = new MutationObserver(records => {
    if (records.some(record => sourceNode(record.target) || [...record.addedNodes, ...record.removedNodes].some(sourceNode))) refresh()
  })
  document.head.append(mirror)
  refresh()
  observer.observe(document.head, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['media', 'disabled', 'href'] })
  const loaded = (event: Event) => { if (event.target instanceof HTMLLinkElement && event.target.rel === 'stylesheet') refresh() }
  document.addEventListener('load', loaded, true)

  return {
    read(element: Element): string {
      const restore: (() => void)[] = []
      try {
        // Mirror inline declarations too, with their existing priority. Only our
        // property is touched; the element's actual cursor is never rewritten.
        for (let node: Element | null = element; node; node = node.parentElement) {
          if (!(node instanceof HTMLElement || node instanceof SVGElement)) continue
          const style = node.style, value = style.getPropertyValue('cursor')
          if (!value) continue
          const previous = style.getPropertyValue(SOURCE), priority = style.getPropertyPriority(SOURCE)
          style.setProperty(SOURCE, value, style.getPropertyPriority('cursor'))
          restore.push(() => previous ? style.setProperty(SOURCE, previous, priority) : style.removeProperty(SOURCE))
        }
        return getComputedStyle(element).getPropertyValue(SOURCE).trim() || 'auto'
      } finally { restore.reverse().forEach(reset => reset()) }
    },
    dispose() {
      observer.disconnect()
      document.removeEventListener('load', loaded, true)
      mirror.remove()
    }
  }
}

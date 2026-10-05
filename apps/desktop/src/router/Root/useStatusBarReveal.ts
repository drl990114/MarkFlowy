import { useEffect, useRef } from 'react'

const hoverAttribute = 'data-mf-status-bar-hover'

function containsPoint(rect: DOMRect, x: number, y: number) {
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    x >= rect.left &&
    x < rect.right &&
    y >= rect.top &&
    y < rect.bottom
  )
}

function isOverScrollbar(surface: HTMLElement, path: EventTarget[], x: number, y: number) {
  // Check geometry even after the toolbar appears above an overlay scrollbar.
  for (const scrollbar of surface.querySelectorAll<HTMLElement>(
    '.os-scrollbar-visible:not(.os-scrollbar-unusable)',
  )) {
    if (
      containsPoint(scrollbar.getBoundingClientRect(), x, y) &&
      getComputedStyle(scrollbar).visibility !== 'hidden'
    ) {
      return true
    }
  }

  // Once revealed, the toolbar is the event target. Include the native scroll
  // containers underneath it so moving onto their gutters hides the toolbar.
  const underlying = surface.ownerDocument.elementsFromPoint?.(x, y) ?? []
  const targets = new Set([...path, ...underlying.filter((element) => surface.contains(element))])
  for (const target of targets) {
    if (!(target instanceof HTMLElement)) continue
    if (target.matches('.os-scrollbar, .os-scrollbar *, [data-separator]')) return true

    const horizontal =
      target.scrollWidth > target.clientWidth && target.offsetHeight > target.clientHeight
    const vertical =
      target.scrollHeight > target.clientHeight && target.offsetWidth > target.clientWidth
    if (!horizontal && !vertical) continue
    const rect = target.getBoundingClientRect()
    if (!containsPoint(rect, x, y)) continue
    if (horizontal && y >= rect.top + target.clientTop + target.clientHeight) return true
    if (
      vertical &&
      (x < rect.left + target.clientLeft || x >= rect.left + target.clientLeft + target.clientWidth)
    )
      return true
  }
  return false
}

export function useStatusBarReveal(enabled: boolean) {
  const statusBarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const bar = statusBarRef.current
    const surface = bar?.parentElement
    if (!enabled || !bar || !surface) return

    let frame: number | undefined
    let pointer: { x: number; y: number; path: EventTarget[] } | undefined
    const setHovered = (hovered: boolean) => {
      if (bar.hasAttribute(hoverAttribute) !== hovered) bar.toggleAttribute(hoverAttribute, hovered)
    }
    const clear = () => {
      if (frame !== undefined) cancelAnimationFrame(frame)
      frame = undefined
      pointer = undefined
      setHovered(false)
    }
    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || event.buttons !== 0) {
        clear()
        return
      }
      pointer = { x: event.clientX, y: event.clientY, path: event.composedPath() }
      if (frame !== undefined) return
      frame = requestAnimationFrame(() => {
        frame = undefined
        if (!pointer) return
        const { x, y, path } = pointer
        setHovered(
          containsPoint(bar.getBoundingClientRect(), x, y) && !isOverScrollbar(surface, path, x, y),
        )
      })
    }
    const down = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || !bar.contains(event.target)) clear()
    }

    // Observe movement through the editor; the invisible bar itself never intercepts it.
    surface.addEventListener('pointermove', move, { capture: true, passive: true })
    surface.addEventListener('pointerdown', down, { capture: true, passive: true })
    surface.addEventListener('pointerleave', clear)
    surface.addEventListener('pointercancel', clear)
    window.addEventListener('blur', clear)
    return () => {
      clear()
      surface.removeEventListener('pointermove', move, true)
      surface.removeEventListener('pointerdown', down, true)
      surface.removeEventListener('pointerleave', clear)
      surface.removeEventListener('pointercancel', clear)
      window.removeEventListener('blur', clear)
    }
  }, [enabled])

  return statusBarRef
}

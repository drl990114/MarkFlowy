import { isBrowser } from './common'

/**
 * Returns the element that has a box.
 */
export function getBoxElement(element: Element): Element | null | undefined {
  if (!isBrowser()) return null
  const window = element.ownerDocument.defaultView
  if (!window) {
    return
  }

  const style = window.getComputedStyle(element)
  const display = style.display

  if (display === 'contents' && element.childElementCount === 1) {
    return element.firstElementChild
  } else if (display === 'none') {
    return
  }

  return element
}

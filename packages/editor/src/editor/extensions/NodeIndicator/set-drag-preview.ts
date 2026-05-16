import { deepCloneElement, injectStyle } from '../../utils/dom'
import { isBrowser } from '../../utils/common'
import { getClientRect } from '../../utils/get-client-rect'

export function setDragPreview(event: React.DragEvent<HTMLDivElement>, element: HTMLElement): void {
  if (!isBrowser()) return
  const { top, bottom, left, right } = getClientRect(element)
  const width = right - left
  const height = bottom - top
  const elementX = left
  const elementY = top

  const { clientX, clientY } = event

  const document = element.ownerDocument

  const container = document.createElement('div')

  // If outsideX is positive, the point is at the left side of the element.
  const outsideX = Math.round(elementX - clientX)
  // If outsideY is positive, the point is above the element.
  const outsideY = Math.round(elementY - clientY)

  const borderX = Math.max(outsideX, 0)
  const borderY = Math.max(outsideY, 0)
  Object.assign(container.style, {
    // Ensuring we don't cause reflow when adding the element to the page using
    // `position:fixed` rather than `position:absolute` so we are positioned on
    // the current viewport. `position:fixed` also creates a new stacking
    // context, so we don't need to do that here.
    // https://github.com/atlassian/pragmatic-drag-and-drop/blob/56276552/packages/core/src/public-utils/element/custom-native-drag-preview/set-custom-native-drag-preview.ts#L60
    position: 'fixed',

    // The element is positioned off-screen to avoid capturing the content of
    // the page on Safari when the dragging element has a transparent background
    // on Safari. See https://github.com/prosekit/prosekit/issues/1153 for more
    // details.
    top: '-1000vh',
    left: '-1000vw',

    // The element should not be interactive.
    pointerEvents: 'none',

    // The element should be on top of everything else.
    zIndex: '2147483647',

    // Only reliable cross browser technique found to push a drag preview away
    // from the cursor is to use transparent borders on the container.
    // https://github.com/atlassian/pragmatic-drag-and-drop/blob/56276552/packages/core/src/public-utils/element/custom-native-drag-preview/pointer-outside-of-preview.ts#L13-L18
    borderLeft: `${borderX}px solid transparent`,
    borderTop: `${borderY}px solid transparent`,

    boxSizing: 'border-box',
    width: `${width + borderX}px`,
    height: `${height + borderY}px`,
  })

  const [clonedElement, styleText] = deepCloneElement(element, true)

  // A hardcoded opacity.
  clonedElement.style.setProperty('opacity', '0.7', 'important')
  // The bounding client rect doesn't include the margin, so we need to remove
  // the margin too from the cloned element so that it can fit the container.
  clonedElement.style.setProperty('margin', '0', 'important')
  // Hide the outline of the cloned element.
  clonedElement.style.setProperty('outline-color', 'transparent', 'important')

  document.body.appendChild(container)
  container.appendChild(clonedElement)
  injectStyle(container, styleText)

  event.dataTransfer?.setDragImage(container, Math.max(-outsideX, 0), Math.max(-outsideY, 0))

  requestAnimationFrame(() => {
    container.remove()
  })
}

import { getDocument, getId } from '@ocavue/utils'
import { isBrowser } from './common'

type ElementEventHandlers = Partial<
  Omit<
    GlobalEventHandlers,
    'addEventListener' | 'addEventListener' | 'removeEventListener' | 'removeEventListener'
  >
>

type ElementAttributes = ElementEventHandlers | Record<string, string>

export function createElement<TagName extends keyof HTMLElementTagNameMap>(
  tagName: TagName,
  attributes?: ElementAttributes | null,
  ...children: Array<HTMLElement | string>
): HTMLElementTagNameMap[TagName] | null {
  if (!isBrowser()) return null
  const element = document.createElement(tagName)
  if (attributes) {
    Object.entries(attributes).forEach(([key, value]) => {
      if (typeof value === 'string') {
        element.setAttribute(key, value)
      } else {
        element[key as keyof ElementEventHandlers] = value
      }
    })
  }
  if (children.length) {
    element.append(...children)
  }
  return element
}

export function isTableCellElement(el: Element | null | undefined): el is HTMLTableCellElement {
  if (!el) {
    return false
  }
  return el.nodeName === 'TD' || el.nodeName === 'TH'
}

/**
 * Creates a deep clone of an Element, including all computed styles so that
 * it looks almost exactly the same as the original element.
 */
export function deepCloneElement<T extends Element>(element: T, important = false): [T, string] {
  const clonedElement = element.cloneNode(true) as T
  const style = deepCopyStyles(element, clonedElement, important)
  return [clonedElement, style]
}
function deepCopyStyles(source: Element, target: Element, important: boolean): string {
  const sources = [source]
  const targets = [target]
  const styles: string[] = []

  while (sources.length > 0 && sources.length === targets.length) {
    const source = sources.shift()
    const target = targets.shift()

    if (!source || !target) {
      break
    }

    const style = copyStyles(source, target, important)
    if (style) {
      styles.push(style)
    }

    // 使用 concat 确保子元素按照正确的顺序添加
    sources.push(...Array.from(source.children))
    targets.push(...Array.from(target.children))
  }

  return styles.join('\n')
}

function copyStyles(source: Element, target: Element, important: boolean): string {
  if (!source || !target) {
    return ''
  }

  const view = source.ownerDocument?.defaultView
  if (!view) {
    return ''
  }

  // Known issue: pseudo styles are not copied.
  const sourceStyle = view.getComputedStyle(source)
  const targetStyle = (target as HTMLElement | SVGElement | MathMLElement).style

  if (!sourceStyle || !targetStyle) {
    return ''
  }

  for (const key of sourceStyle) {
    targetStyle.setProperty(
      key,
      sourceStyle.getPropertyValue(key),
      // Enforce important to avoid the style being overridden when the element
      // is connected to the page.
      // See https://github.com/prosekit/prosekit/issues/1185 for more details.
      important ? 'important' : sourceStyle.getPropertyPriority(key) || '',
    )
  }

  const styles: string[] = []
  for (const pseudoSelector of [':before', ':after']) {
    const sourcePseudoStyle = view.getComputedStyle(source, pseudoSelector)
    const targetPseudoStyle = view.getComputedStyle(target, pseudoSelector)

    if (!sourcePseudoStyle) {
      continue
    }

    const content = sourcePseudoStyle.getPropertyValue('content')
    const hasPseudoElement = content && content !== 'none' && content !== 'normal'

    if (!hasPseudoElement) {
      continue
    }

    const cssProps: string[] = []
    for (const property of sourcePseudoStyle) {
      const sourceValue = sourcePseudoStyle.getPropertyValue(property)
      const sourcePriority = sourcePseudoStyle.getPropertyPriority(property)
      const targetValue = targetPseudoStyle.getPropertyValue(property)
      const targetPriority = targetPseudoStyle.getPropertyPriority(property)
      if (sourceValue !== targetValue || sourcePriority !== targetPriority) {
        cssProps.push(`${property}: ${sourceValue}${sourcePriority ? ' !important' : ''};`)
      }
    }

    const uniqueClassName = `clone-pseudo-element-${getId()}`
    target.classList.add(uniqueClassName)
    styles.push(`.${uniqueClassName}${pseudoSelector} { ${cssProps.join(' ')} }`)
  }

  return styles.join('\n')
}

export function injectStyle(container: HTMLElement, styleText: string): void {
  if (!styleText) {
    return
  }
  const document = getDocument(container)
  const style = document.createElement('style')
  style.textContent = styleText
  container.appendChild(style)
}

export function addLabelToDom(
  dom: HTMLElement,
  params: {
    iconName?: string
    labelName: string
  },
): HTMLElement | null {
  if (!isBrowser()) return null
  const { iconName = 'ri-expand-left-right-line', labelName = '' } = params
  const iconCls = ['cm-render-node-label-icon', iconName].join(' ')

  const label = document.createElement('span')
  label.innerHTML = `<i class="${iconCls}"></i>${labelName}`
  label.classList.add('cm-render-node-label')

  dom.appendChild(label)
  dom.classList.add('cm-render-node')

  return label
}

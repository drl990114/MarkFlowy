import type { EditorView } from '@codemirror/view'
import { getCapricornRuntimeInput } from './capricornRuntimeDom'

let resolveView: typeof EditorView.findFromDOM | undefined

/** Registered by the lazy runtime loader; keep CodeMirror out of startup imports. */
export function setEmbeddedCodeMirrorViewResolver(resolver: typeof resolveView): void {
  resolveView = resolver
}

export interface EmbeddedCodeFocusSnapshot {
  restore: () => boolean
}

export function trackEmbeddedCodeMirrorFocus(container: HTMLElement) {
  const ownerDocument = container.ownerDocument
  let lastView: EditorView | null = null
  let disposed = false
  const ownsContent = (content: Element) => {
    const runtimeContent = container.querySelector('[data-cap-content]')
    return (
      container.isConnected &&
      container.contains(content) &&
      runtimeContent !== null &&
      content.closest('[data-cap-content]') === runtimeContent
    )
  }
  const rememberFocus = (element: Element | null) => {
    const content = element?.closest<HTMLElement>('.cm-content[contenteditable="true"]')
    if (content && ownsContent(content)) {
      lastView = resolveView?.(content) ?? null
    } else if (
      element?.matches('textarea[data-cap-input]') &&
      element === getCapricornRuntimeInput(container)
    ) {
      lastView = null
    }
    // Toolbar/menu/dialog focus preserves the editor's last input surface.
  }
  const onFocus = (event: FocusEvent) => rememberFocus(event.target as Element | null)
  const isCurrentView = (view: EditorView) =>
    !disposed &&
    ownsContent(view.contentDOM) &&
    view.contentDOM.getAttribute('contenteditable') === 'true' &&
    resolveView?.(view.contentDOM) === view

  ownerDocument.addEventListener('focusin', onFocus, true)
  rememberFocus(ownerDocument.activeElement)
  return {
    capture(): EmbeddedCodeFocusSnapshot | null {
      if (disposed) return null
      rememberFocus(ownerDocument.activeElement)
      const view = lastView
      if (!view || !isCurrentView(view)) return null
      const state = view.state
      return {
        restore() {
          if (!isCurrentView(view)) return false
          view.focus()
          // Preserve anchor/head direction, but never replace a newer document's selection.
          if (view.state.doc === state.doc) view.dispatch({ selection: state.selection })
          return view.hasFocus
        },
      }
    },
    destroy() {
      disposed = true
      lastView = null
      ownerDocument.removeEventListener('focusin', onFocus, true)
    },
  }
}

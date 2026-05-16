import type { Extension as CodeMirrorExtension } from '@codemirror/state'
import { ViewPlugin, ViewUpdate } from '@codemirror/view'
import type { CommandFunction, CreateExtensionPlugin } from '@rme-sdk/core'
import { extension, isTextSelection, PlainExtension } from '@rme-sdk/core'
import type { EditorView } from '@rme-sdk/pm/view'
import { isBrowser } from '../../utils/common'

const DEAD_ZONE_PX = 32

type ScrollTarget = HTMLElement | Document

export interface TypewriterScrollOptions {
  /**
   * Whether to enable typewriter scroll behavior.
   * When enabled, the caret will be centered in the viewport during editing.
   * @default true
   */
  enabled?: boolean
}

function isScrollableElement(element: HTMLElement) {
  if (!isBrowser()) return false
  const style = window.getComputedStyle(element)
  const overflowY = style.overflowY
  return (
    overflowY !== 'visible' &&
    overflowY !== 'clip' &&
    element.scrollHeight > element.clientHeight
  )
}

function getScrollTarget(editorView: EditorView): ScrollTarget | null {
  if (!isBrowser()) return null
  let current = editorView.dom.parentElement
  while (current) {
    if (isScrollableElement(current)) {
      return current
    }
    current = current.parentElement
  }

  return document
}

function getScrollTop(target: ScrollTarget | null): number {
  if (!target || !isBrowser()) return 0
  return target === document ? window.scrollY : (target as HTMLElement).scrollTop
}

function getClientHeight(target: ScrollTarget | null): number {
  if (!target || !isBrowser()) return 0
  return target === document ? window.innerHeight : (target as HTMLElement).clientHeight
}

function getMaxScrollTop(target: ScrollTarget | null): number {
  if (!target || !isBrowser()) return 0
  if (target === document) {
    const scrollingElement = document.scrollingElement
    if (!scrollingElement) {
      return 0
    }
    return scrollingElement.scrollHeight - window.innerHeight
  }

  return (target as HTMLElement).scrollHeight - (target as HTMLElement).clientHeight
}

function setScrollTop(target: ScrollTarget | null, top: number): void {
  if (!target || !isBrowser()) return
  if (target === document) {
    window.scrollTo({ top, behavior: 'smooth' })
    return
  }

  (target as HTMLElement).scrollTo({ top, behavior: 'smooth' })
}

function getTargetTop(target: ScrollTarget | null): number {
  if (!target || !isBrowser()) return 0
  return target === document ? 0 : (target as HTMLElement).getBoundingClientRect().top
}

function centerElementInViewport(element: HTMLElement): void {
  if (!isBrowser()) return
  const rect = element.getBoundingClientRect()
  const scrollTop = window.scrollY
  const elementTop = scrollTop + rect.top
  const elementCenter = elementTop + rect.height / 2
  const viewportCenter = scrollTop + window.innerHeight / 2
  const delta = elementCenter - viewportCenter

  if (Math.abs(delta) <= DEAD_ZONE_PX) {
    return
  }

  const nextScrollTop = Math.max(0, Math.min(
    document.documentElement.scrollHeight - window.innerHeight,
    scrollTop + delta
  ))

  if (nextScrollTop !== scrollTop) {
    window.scrollTo({ top: nextScrollTop, behavior: 'smooth' })
  }
}


@extension<TypewriterScrollOptions>({
  defaultOptions: {
    enabled: false,
  },
  staticKeys: [],
  handlerKeys: [],
  customHandlerKeys: [],
})
export class TypewriterScrollExtension extends PlainExtension<TypewriterScrollOptions> {
  get name() {
    return 'typewriterScroll' as const
  }

  /**
   * Toggle typewriter scroll mode
   */
  toggleTypewriterScroll = (enabled?: boolean): CommandFunction => {
    return ({ dispatch }) => {
      if (!dispatch) {
        return true
      }

      const newEnabled = enabled !== undefined ? enabled : !this.options.enabled
      this.setOptions({ enabled: newEnabled })
      return true
    }
  }

  /**
   * Enable typewriter scroll mode
   */
  enableTypewriterScroll = (): CommandFunction => {
    return this.toggleTypewriterScroll(true)
  }

  /**
   * Disable typewriter scroll mode
   */
  disableTypewriterScroll = (): CommandFunction => {
    return this.toggleTypewriterScroll(false)
  }

  createCommands() {
    return {
      toggleTypewriterScroll: this.toggleTypewriterScroll,
      enableTypewriterScroll: this.enableTypewriterScroll,
      disableTypewriterScroll: this.disableTypewriterScroll,
    }
  }

  createHelpers() {
    return {
      isTypewriterScrollEnabled: (): boolean => this.options.enabled,
    }
  }

  createCodeMirrorExtension(): CodeMirrorExtension {
    const self = this

    return ViewPlugin.fromClass(class {
      private rafId: number | null = null

      update(update: ViewUpdate) {
        if (!self.options.enabled) {
          return
        }

        if (!update.docChanged && !update.selectionSet) {
          return
        }

        this.scheduleCenter(update)
      }

      private scheduleCenter(update: ViewUpdate) {
        if (this.rafId !== null) {
          cancelAnimationFrame(this.rafId)
        }

        this.rafId = requestAnimationFrame(() => {
          this.rafId = null
          this.centerCaretLine(update)
        })
      }

      private centerCaretLine(update: ViewUpdate) {
        if (!isBrowser()) return
        const { view } = update

        // 获取当前光标位置
        const selection = view.state.selection.main
        const head = selection.head

        // 获取光标所在的行
        const line = view.state.doc.lineAt(head)

        // 获取这一行在视口中的位置
        const linePos = line.from
        const coords = view.coordsAtPos(linePos)

        if (!coords) {
          return
        }

        // 计算行的中心位置
        const lineTop = coords.top
        const lineBottom = coords.bottom
        const lineCenter = (lineTop + lineBottom) / 2

        // 计算视口中心
        const viewportCenter = window.innerHeight / 2

        // 计算需要滚动的距离
        const delta = lineCenter - viewportCenter

        if (Math.abs(delta) <= DEAD_ZONE_PX) {
          return
        }

        // 执行滚动
        const scrollTop = window.scrollY
        const nextScrollTop = Math.max(0, Math.min(
          document.documentElement.scrollHeight - window.innerHeight,
          scrollTop + delta
        ))

        if (nextScrollTop !== scrollTop) {
          window.scrollTo({ top: nextScrollTop, behavior: 'smooth' })
        }
      }

      destroy() {
        if (this.rafId !== null) {
          cancelAnimationFrame(this.rafId)
        }
      }
    })
  }

  createPlugin(): CreateExtensionPlugin {
    let rafId: number | null = null
    let isComposing = false

    const clearRaf = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
    }

    const hasNestedEditorFocus = (editorView: EditorView) => {
      if (!isBrowser()) return false
      const activeElement = document.activeElement
      if (!activeElement || activeElement === editorView.dom) {
        return false
      }
      if (!editorView.dom.contains(activeElement)) {
        return false
      }
      return Boolean(activeElement.closest('.cm-editor'))
    }

    const centerCaret = (editorView: EditorView) => {
      if (!this.options.enabled) {
        return
      }

      if (isComposing || !editorView.hasFocus()) {
        return
      }

      const scrollTarget = getScrollTarget(editorView)
      const maxScrollTop = getMaxScrollTop(scrollTarget)
      if (maxScrollTop <= 0) {
        return
      }

      try {
        let caretTop: number
        let caretBottom: number

        if (hasNestedEditorFocus(editorView)) {
          if (!isBrowser()) return
          const activeElement = document.activeElement
          const cmEditor = activeElement?.closest('.cm-editor')
          if (!cmEditor) {
            return
          }

          const cmContent = cmEditor.querySelector('.cm-content') as HTMLElement
          if (!cmContent) {
            return
          }

          const selection = window.getSelection()
          if (!selection || selection.rangeCount === 0) {
            return
          }

          const range = selection.getRangeAt(0)
          const rects = range.getClientRects()
          if (rects.length === 0) {
            return
          }

          const rect = rects[0]
          const scrollTop = getScrollTop(scrollTarget)
          const targetTop = getTargetTop(scrollTarget)

          caretTop = scrollTop + rect.top - targetTop
          caretBottom = scrollTop + rect.bottom - targetTop
        } else {
          const { selection } = editorView.state
          if (!isTextSelection(selection) || !selection.empty) {
            return
          }

          const caret = editorView.coordsAtPos(selection.head)
          if (!caret) {
            return
          }

          const scrollTop = getScrollTop(scrollTarget)
          const targetTop = getTargetTop(scrollTarget)
          caretTop = scrollTop + caret.top - targetTop
          caretBottom = scrollTop + caret.bottom - targetTop
        }

        const caretCenter = (caretTop + caretBottom) / 2
        const targetCenter = getScrollTop(scrollTarget) + getClientHeight(scrollTarget) / 2
        const delta = caretCenter - targetCenter

        if (Math.abs(delta) <= DEAD_ZONE_PX) {
          return
        }

        const nextScrollTop = Math.max(0, Math.min(maxScrollTop, getScrollTop(scrollTarget) + delta))
        if (nextScrollTop !== getScrollTop(scrollTarget)) {
          setScrollTop(scrollTarget, nextScrollTop)
        }
      } catch {
        return
      }
    }

    const scheduleCenter = (editorView: EditorView) => {
      clearRaf()
      if (!isBrowser()) return
      rafId = requestAnimationFrame(() => {
        rafId = null
        centerCaret(editorView)
      })
    }

    const handleCodeMirrorUpdate = () => {
      if (editorView && hasNestedEditorFocus(editorView)) {
        scheduleCenter(editorView)
      }
    }

    let editorView: EditorView | null = null

    return {
      view: (view) => {
        editorView = view

        const handleSelectionChange = () => {
          if (editorView && hasNestedEditorFocus(editorView)) {
            scheduleCenter(editorView)
          }
        }

        if (isBrowser()) {
          document.addEventListener('selectionchange', handleSelectionChange)
        }

        return {
          update: (nextView, prevState) => {
            if (nextView !== view) {
              return
            }

            const docChanged = !nextView.state.doc.eq(prevState.doc)
            const selectionChanged = !nextView.state.selection.eq(prevState.selection)
            if (!docChanged && !selectionChanged) {
              return
            }

            scheduleCenter(nextView)
          },
          destroy: () => {
            clearRaf()
            if (isBrowser()) {
              document.removeEventListener('selectionchange', handleSelectionChange)
            }
            editorView = null
          },
        }
      },
      props: {
        handleDOMEvents: {
          compositionstart: () => {
            isComposing = true
            return false
          },
          compositionend: (view) => {
            isComposing = false
            scheduleCenter(view)
            return false
          },
          focus: (view) => {
            scheduleCenter(view)
            return false
          },
          blur: () => {
            clearRaf()
            isComposing = false
            return false
          },
        },
      },
    }
  }
}

import { TextSelection, type Transaction } from '@rme-sdk/pm/state'
import type { EditorView } from '@rme-sdk/pm/view'

import { PlainExtension } from '@rme-sdk/main'
import { applySelectionMarks } from './inline-mark-helpers'

export class LineInlineMarkExtension extends PlainExtension {
  get name() {
    return 'inlineMark' as const
  }

  createPlugin() {
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const debounceApplyMarks = (view: EditorView): void => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      timeoutId = setTimeout(() => {
        if (view.isDestroyed) {
          timeoutId = null
          return
        }

        const currentDoc = view.state.doc
        const currentSelection = view.state.selection
        const { $head, $anchor } = currentSelection

        applySelectionMarks(view)

        const maxPos = currentDoc.content.size
        const validHeadPos = Math.min(Math.max($head.pos, 0), maxPos)
        const validAnchorPos = Math.min(Math.max($anchor.pos, 0), maxPos)

        if (validHeadPos >= 0 && validHeadPos <= maxPos && validAnchorPos >= 0 && validAnchorPos <= maxPos) {
          try {
            const $validHead = currentDoc.resolve(validHeadPos)
            const $validAnchor = currentDoc.resolve(validAnchorPos)
            const newSelection = $validHead.parent === $validAnchor.parent
              ? TextSelection.create(currentDoc, validAnchorPos, validHeadPos)
              : TextSelection.create(currentDoc, validHeadPos)
            view.dispatch(view.state.tr.setSelection(newSelection))
          } catch {
          }
        }

        timeoutId = null
      }, 10)
    }

    let view: EditorView | null = null

    return {
      appendTransaction: (transactions: readonly Transaction[]): Transaction | null | undefined => {
        let shouldUpdate = false

        for (const tr of transactions) {
          if (tr.docChanged && !tr.getMeta('APPLY_MARKS')) {
            shouldUpdate = true
            break
          }
        }

        if (shouldUpdate && view && !view.isDestroyed) {
          debounceApplyMarks(view)
        }
        return
      },

      view: (editorView: EditorView | null) => {
        view = editorView
        return {}
      },
    }
  }
}

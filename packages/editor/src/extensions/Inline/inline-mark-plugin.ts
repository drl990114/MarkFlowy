import type { Transaction } from '@remirror/pm/state'
import type { EditorView } from '@remirror/pm/view'

import { applySelectionMarks } from './inline-mark-helpers'
import { PlainExtension } from 'remirror'

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
        applySelectionMarks(view)
        timeoutId = null
      }, 100)
    }

    let view: EditorView | null = null

    return {
      appendTransaction: (
        transactions: readonly Transaction[],
      ): Transaction | null | undefined => {
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

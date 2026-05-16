import type { CommandFunction } from '@rme-sdk/core'
import { Selection } from '@rme-sdk/pm/state'

/**
 * Handling cursor motion from the outer to the inner editor must be done with a
 * keymap on the outer editor. The `arrowHandler` function uses the
 * `endOfTextblock` method to determine, in a bidi-text-aware way, whether the
 * cursor is at the end of a given textblock. If it is, and the next block is a
 * code block, the selection is moved into it.
 *
 * Adapted from https://prosemirror.net/examples/codemirror/
 */
export function arrowHandler(dir: 'left' | 'right' | 'up' | 'down'): CommandFunction {
  return ({ dispatch, view, tr }) => {
    if (!view) {
      return false
    }

    if (!(tr.selection.empty && view.endOfTextblock(dir))) {
      return false
    }

    const side = dir === 'left' || dir === 'up' ? -1 : 1
    const $head = tr.selection.$head
    const nextPos = Selection.near(tr.doc.resolve(side > 0 ? $head.after() : $head.before()), side)

    if (
      nextPos.$head &&
      (nextPos.$head.parent.type.name === 'codeMirror' ||
        nextPos.$head.parent.type.name === 'html_block' ||
        nextPos.$head.parent.type.name === 'mermaid_node' ||
        nextPos.$head.parent.type.name === 'math_block')
    ) {
      dispatch?.(tr.setSelection(nextPos))
      if (dir === 'down' && nextPos.$head.parent.type.name === 'codeMirror') {
        const pos = nextPos.$head.before()
        requestAnimationFrame(() => {
          const menu = view.dom.querySelector(
            `.code-block__menu[data-pos="${pos}"]`,
          ) as HTMLElement | null
          const input = menu?.querySelector(
            '.code-block__languages__input',
          ) as HTMLInputElement | null
          input?.focus()
        })
      }
      return true
    }

    return false
  }
}

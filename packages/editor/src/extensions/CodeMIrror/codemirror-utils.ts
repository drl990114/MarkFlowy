import type { CommandFunction } from '@remirror/core'
import { Selection } from '@remirror/pm/state'

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
    console.log('arrowHandler', dir, tr.selection.empty, view?.endOfTextblock(dir))
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
        nextPos.$head.parent.type.name === 'html_block')
    ) {
      dispatch?.(tr.setSelection(nextPos))
      return true
    }

    return false
  }
}

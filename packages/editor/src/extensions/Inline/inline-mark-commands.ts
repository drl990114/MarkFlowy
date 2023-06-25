import type { CommandFunction, CommandFunctionProps, ProsemirrorNode } from '@remirror/core'
import type { Transaction } from '@remirror/pm/state'
import { TextSelection } from '@remirror/pm/state'

import { updateRangeMarks } from './inline-mark-helpers'

type CreateInlineKeyBindingProps = {
  left: string
  right: string
  mark: ToggleableInlineMarkName
}

function findMarkIndex(
  textBlockNode: ProsemirrorNode,
  mark: string,
  fromIndex: number,
  toIndex: number,
  empty: boolean,
): false | number {
  for (let index = fromIndex; index <= toIndex; index++) {
    if (hasMark(textBlockNode.maybeChild(index), mark)) {
      return index
    }
  }
  if (empty || fromIndex === toIndex) {
    if (
      hasMark(textBlockNode.maybeChild(fromIndex), 'mdMark') &&
      hasMark(textBlockNode.maybeChild(fromIndex - 1), mark)
    ) {
      return fromIndex - 1
    }

    if (
      hasMark(textBlockNode.maybeChild(toIndex), 'mdMark') &&
      hasMark(textBlockNode.maybeChild(toIndex + 1), mark)
    ) {
      return toIndex + 1
    }
  }

  return false
}

function deleteSimpleInlineMark({
  left,
  right,
  mark,
}: CreateInlineKeyBindingProps): CommandFunction {
  return (props: CommandFunctionProps): boolean => {
    const { tr, dispatch, state } = props
    const { $from, $to, empty } = state.selection

    const textBlockNode = $from.parent
    const textBlockStart = $from.start()

    let fromIndex = $from.index()
    let toIndex = $to.index()

    // `$to` is between two text nodes and `toIndex` is pointing to the right text node.
    if ($to.textOffset === 0) {
      if (empty) {
        fromIndex = Math.max(fromIndex - 1, 0)
      } else if (toIndex > fromIndex) {
        toIndex--
      }
    }

    const existedMarkIndex = findMarkIndex(textBlockNode, mark, fromIndex, toIndex, empty)

    if (existedMarkIndex !== false) {
      let found = false
      for (let i = existedMarkIndex; i < textBlockNode.childCount; i++) {
        const textNode = textBlockNode.child(i)
        if (hasMark(textNode, 'mdMark') && textNode.text === right) {
          deleteTextBlockChild(tr, textBlockNode, textBlockStart, i)
          found = true
        }
      }
      for (let i = existedMarkIndex; i >= 0; i--) {
        const textNode = textBlockNode.child(i)
        if (hasMark(textNode, 'mdMark') && textNode.text === left) {
          deleteTextBlockChild(tr, textBlockNode, textBlockStart, i)
          found = true
        }
      }
      if (found) {
        if (dispatch) {
          updateRangeMarks(tr)
          dispatch(tr)
        }
        return true
      }
    }

    return false
  }
}

function addSimpleInlineMark({ left, right }: CreateInlineKeyBindingProps): CommandFunction {
  return (props: CommandFunctionProps): boolean => {
    const { tr, dispatch, state } = props
    const { $from, $to, anchor, head } = state.selection

    if (dispatch) {
      tr.insertText(right, $to.pos)
      tr.insertText(left, $from.pos)
      const offset = left.length
      tr.setSelection(TextSelection.create(tr.doc, anchor + offset, head + offset))
      updateRangeMarks(tr)
      dispatch(tr)
    }

    return true
  }
}

function toggleSimpleInlineMark({
  left,
  right,
  mark,
}: CreateInlineKeyBindingProps): CommandFunction {
  return (props: CommandFunctionProps): boolean => {
    const { $from, $to } = props.state.selection

    if (!$from.sameParent($to) || !$from.parent.type.isTextblock) {
      return false
    }

    if (deleteSimpleInlineMark({ left, right, mark })(props)) {
      return true
    }

    if (addSimpleInlineMark({ left, right, mark })(props)) {
      return true
    }

    return false
  }
}

/** @public */
export type ToggleableInlineMarkName = 'mdStrong' | 'mdEm' | 'mdCodeText' | 'mdDel'

export function toggleInlineMark(mark: ToggleableInlineMarkName): CommandFunction {
  switch (mark) {
    case 'mdStrong':
      return toggleSimpleInlineMark({ mark, left: '**', right: '**' })
    case 'mdEm':
      return toggleSimpleInlineMark({ mark, left: '*', right: '*' })
    case 'mdCodeText':
      return toggleSimpleInlineMark({ mark, left: '`', right: '`' })
    case 'mdDel':
      return toggleSimpleInlineMark({ mark, left: '~~', right: '~~' })
    default:
      throwUnknownMarkError(mark)
  }
}

export type ToggleInlineMark = typeof toggleInlineMark

function throwUnknownMarkError(mark: never): never {
  throw new Error(`Unknown mark to toggle: ${mark}`)
}

function hasMark(node: ProsemirrorNode | null | undefined, mark: string): boolean {
  if (!node) {
    return false
  }

  return node.marks.some((m) => m.type.name === mark)
}

function deleteTextBlockChild(
  tr: Transaction,
  textBlockNode: ProsemirrorNode,
  textBlockStart: number,
  childIndex: number,
): Transaction {
  let offset = textBlockStart
  for (let i = 0; i < childIndex; i++) {
    offset += textBlockNode.child(i).nodeSize
  }
  return tr.delete(offset, offset + textBlockNode.child(childIndex).nodeSize)
}

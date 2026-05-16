import { InputRule } from 'prosemirror-inputrules'
import type { Attrs } from 'prosemirror-model'
import type { Transaction } from 'prosemirror-state'
import { findWrapping } from 'prosemirror-transform'

import type { ListAttributes } from './types'
import { getListType } from './utils/get-list-type'
import { isListNode } from './utils/is-list-node'
import { parseInteger } from './utils/parse-integer'

// Helper function to check if we're inside a table cell
function isInsideTableCell($pos: any): boolean {
  for (let depth = $pos.depth; depth > 0; depth--) {
    const node = $pos.node(depth)
    if (node.type.name === 'tableCell' || node.type.name === 'tableHeaderCell') {
      return true
    }
  }
  return false
}

/**
 * A callback function to get the attributes for a list input rule.
 *
 * @public @group Input Rules
 */
export type ListInputRuleAttributesGetter<
  T extends ListAttributes = ListAttributes,
> = (options: {
  /**
   * The match result of the regular expression.
   */
  match: RegExpMatchArray

  /**
   * The previous attributes of the existing list node, if it exists.
   */
  attributes?: T
}) => T

/**
 * Build an input rule for automatically wrapping a textblock into a list node
 * when a given string is typed.
 *
 * @public @group Input Rules
 */
export function wrappingListInputRule<
  T extends ListAttributes = ListAttributes,
>(regexp: RegExp, getAttrs: T | ListInputRuleAttributesGetter<T>): InputRule {
  return new InputRule(
    regexp,
    (state, match, start, end): Transaction | null => {
      const tr = state.tr
      tr.deleteRange(start, end)
      const $pos = tr.selection.$from

      // Check if we're inside a table cell - if so, don't create a list
      if (isInsideTableCell($pos)) {
        return null
      }

      const listNode = $pos.index(-1) === 0 && $pos.node(-1)
      if (listNode && isListNode(listNode)) {
        const oldAttrs: Attrs = listNode.attrs as ListAttributes
        const newAttrs: Attrs =
          typeof getAttrs === 'function'
            ? getAttrs({ match, attributes: oldAttrs as T })
            : getAttrs

        const entries = Object.entries(newAttrs).filter(([key, value]) => {
          return oldAttrs[key] !== value
        })
        if (entries.length === 0) {
          return null
        } else {
          const pos = $pos.before(-1)
          for (const [key, value] of entries) {
            tr.setNodeAttribute(pos, key, value)
          }
          return tr
        }
      }

      const $start = tr.doc.resolve(start)
      const range = $start.blockRange()
      if (!range) {
        return null
      }

      const newAttrs: Attrs =
        typeof getAttrs === 'function' ? getAttrs({ match }) : getAttrs
      const wrapping = findWrapping(range, getListType(state.schema), newAttrs)
      if (!wrapping) {
        return null
      }

      return tr.wrap(range, wrapping)
    },
  )
}

/**
 * All input rules for lists.
 *
 * @public @group Input Rules
 */
export const listInputRules: InputRule[] = [
  wrappingListInputRule<ListAttributes>(/^\s?([*-])\s$/, {
    kind: 'bullet',
    collapsed: false,
  }),
  wrappingListInputRule<ListAttributes>(/^\s?(\d+)\.\s$/, ({ match }) => {
    const order = parseInteger(match[1])
    return {
      kind: 'ordered',
      collapsed: false,
      order: order != null && order >= 2 ? order : null,
    }
  }),
  wrappingListInputRule<ListAttributes>(/^\s?\[([\sXx]?)]\s$/, ({ match }) => {
    return {
      kind: 'task',
      checked: ['x', 'X'].includes(match[1]),
      collapsed: false,
    }
  }),
  wrappingListInputRule<ListAttributes>(/^\s?>>\s$/, {
    kind: 'toggle',
  }),
]

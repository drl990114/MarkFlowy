import type { DOMOutputSpec, NodeSpec } from 'prosemirror-model'

import { createParseDomRules } from './parse-dom'
import { listToDOM } from './to-dom'

/**
 * The default group name for list nodes. This is used to find the list node
 * type from the schema.
 *
 * @internal Schema
 */
export const flatListGroup = 'flatList'

/**
 * Return the spec for list node.
 *
 *  @public @group Schema
 */
export function createListSpec(): NodeSpec {
  return {
    content: 'block+',
    group: `${flatListGroup} block`,
    definingForContent: true,
    definingAsContext: false,
    attrs: {
      kind: {
        default: 'bullet',
      },
      order: {
        default: null,
      },
      checked: {
        default: false,
      },
      collapsed: {
        default: false,
      },
    },
    toDOM: (node): DOMOutputSpec => {
      return listToDOM({ node })
    },

    parseDOM: createParseDomRules(),
  }
}

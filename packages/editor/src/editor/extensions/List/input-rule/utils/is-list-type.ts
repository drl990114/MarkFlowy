import type { NodeType } from 'prosemirror-model'

import { getListTypeName } from './get-list-type-name'

/** @public */
export function isListType(type: NodeType): boolean {
  return getListTypeName(type.schema) === type.name
}

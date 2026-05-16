import type { NodeType, Schema } from 'prosemirror-model'

import { getListTypeName } from './get-list-type-name'

/** @internal */
export function getListType(schema: Schema): NodeType {
  return schema.nodes[getListTypeName(schema)]
}

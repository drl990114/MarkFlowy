import type { Schema } from 'prosemirror-model'

import { flatListGroup } from '../schema/node-spec'

const key = 'PROSEMIRROR_FLAT_LIST_TYPE_NAME'

/** @internal */
export function getListTypeName(schema: Schema): string {
  let name: string = schema.cached[key] as string

  if (!name) {
    for (const type of Object.values(schema.nodes)) {
      if ((type.spec.group || '').split(' ').includes(flatListGroup)) {
        name = type.name
        break
      }
    }

    if (!name) {
      throw new TypeError(
        '[prosemirror-flat-list] Unable to find a flat list type in the schema',
      )
    }

    schema.cached[key] = name
    return name
  }

  return name
}

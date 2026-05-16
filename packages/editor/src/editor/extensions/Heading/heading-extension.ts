import type {
  ApplySchemaAttributes,
  ExtensionCommandReturn,
  KeyBindings,
  NodeExtensionSpec,
  NodeSpecOverride
} from '@rme-sdk/core'
import { convertCommand, findParentNodeOfType } from '@rme-sdk/core'
import { HeadingExtension } from '@rme-sdk/main/extensions'
import { setBlockType } from '@rme-sdk/pm/commands'
import type { Schema } from '@rme-sdk/pm/model'
import type Token from 'markdown-it/lib/token.mjs'

import type { NodeSerializerOptions } from '../../transform'
import { ParserRuleType } from '../../transform'

export class LineHeadingExtension extends HeadingExtension {
  createNodeSpec(extra: ApplySchemaAttributes, override: NodeSpecOverride): NodeExtensionSpec {
    return {
      ...super.createNodeSpec(extra, override),
    }
  }

  createKeymap() {
    const keys: KeyBindings = {
      Backspace: ({ state, dispatch }) => {
        const { selection } = state
        const { $from } = selection
        // If the selection is not empty, return false and let other extension (ie: BaseKeymapExtension) to do
        // the deleting operation.
        if (!selection.empty) {
          return false
        }

        if ($from.parent.type.name !== this.name) {
          return false
        }

        const parent = findParentNodeOfType({ types: this.type, selection })
        if (parent?.start !== selection.from) {
          return false
        }

        const tr = state.tr.setBlockType(
          parent.start,
          parent.start,
          (state.schema as Schema).nodes.paragraph,
        )
        if (dispatch) {
          dispatch(tr)
        }
        return true
      },
    }

    return keys
  }

  createCommands() {
    const keys: ExtensionCommandReturn = {}
    this.options.levels.forEach((level) => {
      keys[`toggleH${level}`] = () => convertCommand(setBlockType(this.type, { level }))
    })
    return keys
  }

  fromMarkdown() {
    return [
      {
        type: ParserRuleType.block,
        token: 'heading',
        node: this.name,
        hasOpenClose: true,
        getAttrs: (tok: Token) => ({ level: +tok.tag.slice(1) }),
      },
    ] as const
  }

  toMarkdown({ state, node }: NodeSerializerOptions) {
    state.write(state.repeat('#', node.attrs.level) + ' ')
    state.renderInline(node)
    state.closeBlock(node)
  }
}

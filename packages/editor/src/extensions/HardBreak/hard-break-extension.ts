import { chainCommands, convertCommand } from '@remirror/core'
import { HardBreakExtension } from 'remirror/extensions'
import { baseKeymap, exitCode } from '@remirror/pm/commands'

import type { NodeSerializerOptions } from '../../transform'

const needUseBrNodeNames = ['tableCell']

export class LineHardBreakExtension extends HardBreakExtension {
  fromMarkdown() {
    return []
  }

  toMarkdown({ state, node, parent, index }: NodeSerializerOptions) {
    for (let i = index + 1; i < parent.childCount; i++)
      if (parent.child(i).type != node.type) {
        state.write('\n')
        return
      }
  }

  createKeymap() {
    const disallowBreakNodes = new Set(['heading'])

    const enterCommand = convertCommand(baseKeymap.Enter)

    const command = chainCommands(convertCommand(exitCode), (params) => {
      const { state, tr, dispatch } = params
      const { $from, $to, from, to } = state.selection
      const canReplace =
        !disallowBreakNodes.has($from.parent.type.name) &&
        !disallowBreakNodes.has($to.parent.type.name)
      const nodeName = $from.parent.type.name
      if (canReplace) {
        const schema = state.schema

        if (needUseBrNodeNames.includes(nodeName)) {
          dispatch?.(tr.replaceRangeWith(from, to, schema.text('<br/>\n')))
        } else {
          dispatch?.(tr.replaceRangeWith(from, to, schema.text('\n')))
        }
        return true
      } else {
        // If the parent doesn't allow HardBreak type (Heading for example), then fall back to `Enter` command
        return enterCommand(params)
      }
    })

    return {
      'Mod-Enter': command,
      'Shift-Enter': command,
    }
  }
}

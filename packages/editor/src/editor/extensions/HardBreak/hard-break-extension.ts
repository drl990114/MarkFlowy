import { convertCommand } from '@rme-sdk/core'
import { HardBreakExtension } from '@rme-sdk/main/extensions'
import { baseKeymap, exitCode } from '@rme-sdk/pm/commands'

import { chainCommands } from '@rme-sdk/pm'
import type { NodeSerializerOptions } from '../../transform'
import { exitTable } from '../Table/table-utils'

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

    const insertLineBreak = (params: Parameters<ReturnType<typeof convertCommand>>[0]) => {
      const { state, tr, dispatch } = params
      const { $from, $to, from, to } = state.selection
      const canReplace =
        !disallowBreakNodes.has($from.parent.type.name) &&
        !disallowBreakNodes.has($to.parent.type.name)
      const nodeName = $from.parent.type.name
      if (canReplace) {
        const schema = state.schema

        if (needUseBrNodeNames.includes(nodeName)) {
          dispatch?.(tr.replaceRangeWith(from, to, schema.nodes.html_br.create()))
        } else {
          dispatch?.(tr.replaceRangeWith(from, to, schema.text('\n')))
        }
        return true
      } else {
        // If the parent doesn't allow HardBreak type (Heading for example), then fall back to `Enter` command
        return enterCommand(params)
      }
    }

    const exitCodeCommand = convertCommand(exitCode)

    return {
      'Mod-Enter': chainCommands(exitCodeCommand, convertCommand(exitTable), insertLineBreak),
      'Shift-Enter': chainCommands(exitCodeCommand, insertLineBreak),
    }
  }
}

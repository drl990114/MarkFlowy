import type { ProsemirrorNode } from '@remirror/core'
import { isString } from '@remirror/core'
import type Token from 'markdown-it/lib/token'
import type { ListAttributes } from 'remirror-extension-flat-list'
import { ListExtension } from 'remirror-extension-flat-list'
import type { MarkdownParseState, NodeSerializerOptions } from '../../transform'
import { ParserRuleType } from '../../transform'
import type { NodeSerializerSpec, ParserRule } from '../../transform'

export abstract class MarkdownNodeExtension {
  abstract fromMarkdown: () => readonly ParserRule[]
  abstract toMarkdown: NodeSerializerSpec
}

export class LineListExtension extends ListExtension implements MarkdownNodeExtension {
  public fromMarkdown() {
    return [
      {
        type: ParserRuleType.free,
        token: 'list_item_open',
        handler: (state: MarkdownParseState): void => {
          switch (state.topContext()) {
            case 'ordered_list':
              state.openNode(this.type, { kind: 'ordered' } satisfies ListAttributes)
              break
            case 'bullet_list':
              state.openNode(this.type, { kind: 'bullet' } satisfies ListAttributes)
              break
            default:
              throw new Error('unknown context')
          }
        },
      },
      {
        type: ParserRuleType.free,
        token: 'list_checkbox',
        handler: (state: MarkdownParseState, tok: Token) => {
          const parent = state.stack[state.stack.length - 1]
          if (parent?.type.name === 'list') {
            const checked: null | string | boolean = tok.attrGet('checked')
            const attrs: ListAttributes = { kind: 'task', checked: isString(checked) || !!checked }
            parent.attrs = attrs
          } else {
            console.warn(`expect list but got ${parent?.type.name}`)
          }
        },
      },
      {
        type: ParserRuleType.free,
        token: 'list_item_close',
        handler: (state: MarkdownParseState): void => {
          state.closeNode()
        },
      },
      {
        type: ParserRuleType.context,
        token: 'bullet_list',
        context: 'bullet_list',
      },
      {
        type: ParserRuleType.context,
        token: 'ordered_list',
        context: 'ordered_list',
      },
    ] as const
  }

  public toMarkdown({ state, node, counter }: NodeSerializerOptions) {
    const attrs = node.attrs as ListAttributes
    let firstDelim = ''
    if (attrs.kind === 'ordered') {
      firstDelim = `${counter}. `
    } else if (attrs.kind === 'task') {
      firstDelim = attrs.checked ? '- [x] ' : '- [ ] '
    } else if (attrs.kind === 'bullet') {
      firstDelim = '- '
    }

    state.wrapBlock(' '.repeat(firstDelim.length), firstDelim, node, () =>
      state.renderContent(node),
    )
  }
}

export function isOrderedListNode(node: ProsemirrorNode): boolean {
  return node.type.name === 'list' && (node.attrs as ListAttributes).kind === 'ordered'
}

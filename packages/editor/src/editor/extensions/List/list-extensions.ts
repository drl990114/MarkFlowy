import type Token from 'markdown-it/lib/token.mjs'
import {
  BulletListExtension,
  ListItemExtension,
  OrderedListExtension,
  StandardListExtension,
} from '@rme-sdk/sdk/extensions/list'

import type {
  MarkdownParseState,
  NodeSerializerOptions,
  NodeSerializerSpec,
  ParserRule,
} from '../../transform'
import { ParserRuleType } from '../../transform'

export abstract class MarkdownNodeExtension {
  abstract fromMarkdown: () => readonly ParserRule[]
  abstract toMarkdown: NodeSerializerSpec
}

function getListTight(token: Token): boolean {
  return token.meta?.tight !== false
}

function getOrderedListStart(token: Token): number {
  const start = Number(token.attrGet('start') ?? token.attrGet('order') ?? 1)
  return Number.isSafeInteger(start) && start >= 1 ? start : 1
}

function getTaskMarker(checked: unknown): string {
  return checked === null || checked === undefined ? '' : checked ? '[x] ' : '[ ] '
}

class LineBulletListExtension extends BulletListExtension {
  public fromMarkdown() {
    return [
      {
        type: ParserRuleType.block,
        token: 'bullet_list',
        node: this.name,
        hasOpenClose: true,
        getAttrs: (token: Token) => ({ tight: getListTight(token) }),
      },
    ] as const
  }

  public toMarkdown({ state, node }: NodeSerializerOptions) {
    state.renderList(
      node,
      () => '    ',
      (index) => `- ${getTaskMarker(node.child(index).attrs.checked)}`,
    )
  }
}

class LineOrderedListExtension extends OrderedListExtension {
  public fromMarkdown() {
    return [
      {
        type: ParserRuleType.block,
        token: 'ordered_list',
        node: this.name,
        hasOpenClose: true,
        getAttrs: (token: Token) => ({
          order: getOrderedListStart(token),
          tight: getListTight(token),
        }),
      },
    ] as const
  }

  public toMarkdown({ state, node }: NodeSerializerOptions) {
    const start = Number(node.attrs.order ?? 1)
    const marker = (index: number) => `${start + index}. `

    state.renderList(
      node,
      (index) => state.repeat(' ', Math.max(4, marker(index).length)),
      (index) => `${marker(index)}${getTaskMarker(node.child(index).attrs.checked)}`,
    )
  }
}

class LineListItemExtension extends ListItemExtension {
  public fromMarkdown() {
    return [
      {
        type: ParserRuleType.block,
        token: 'list_item',
        node: this.name,
        hasOpenClose: true,
        getAttrs: () => ({ checked: null }),
      },
      {
        type: ParserRuleType.free,
        token: 'list_checkbox',
        handler: (state: MarkdownParseState, token: Token) => {
          const item = state.top()
          if (item.type.name !== this.name) {
            throw new Error(`Expected ${this.name} while parsing a task marker`)
          }

          item.attrs = {
            ...item.attrs,
            checked: token.attrGet('checked') !== null,
          }
        },
      },
    ] as const
  }

  public toMarkdown({ state, node }: NodeSerializerOptions) {
    const firstChild = node.firstChild
    const contentStart =
      node.childCount > 1 &&
      firstChild?.type.name === 'paragraph' &&
      firstChild.content.size === 0
        ? 1
        : 0

    // The standard list schema requires a leading paragraph and inserts an
    // empty one when Markdown starts with another block (for example, a
    // heading). That paragraph has no source representation, so omit it when
    // serializing the rest of the list item.
    for (let index = contentStart; index < node.childCount; index += 1) {
      state.render(node.child(index), node, index)
    }
  }
}

export class LineStandardListExtension extends StandardListExtension {
  public createExtensions() {
    return [
      new LineBulletListExtension(),
      new LineOrderedListExtension(),
      new LineListItemExtension(),
    ]
  }
}

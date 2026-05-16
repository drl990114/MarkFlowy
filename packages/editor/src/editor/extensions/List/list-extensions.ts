import type { InputRule, ProsemirrorNode } from '@rme-sdk/core'
import { isString } from '@rme-sdk/core'
import type Token from 'markdown-it/lib/token.mjs'
import type {
  MarkdownParseState,
  NodeSerializerOptions,
  NodeSerializerSpec,
  ParserRule,
} from '../../transform'
import { ParserRuleType } from '../../transform'
import { listInputRules } from './input-rule'

export abstract class MarkdownNodeExtension {
  abstract fromMarkdown: () => readonly ParserRule[]
  abstract toMarkdown: NodeSerializerSpec
}

import {
  convertCommand,
  ExtensionTag,
  type KeyBindings,
  NodeExtension,
  type NodeExtensionSpec,
  type ProsemirrorPlugin,
  type ExtensionCommandReturn,
} from '@rme-sdk/core'
import type { NodeRange } from '@rme-sdk/pm/model'
import {
  createDedentListCommand,
  createIndentListCommand,
  createListPlugins,
  createListSpec,
  createMoveListCommand,
  createSplitListCommand,
  createToggleCollapsedCommand,
  createToggleListCommand,
  createUnwrapListCommand,
  createWrapInListCommand,
  type DedentListOptions,
  type IndentListOptions,
  listKeymap,
  protectCollapsed,
  type ToggleCollapsedOptions,
  type UnwrapListOptions,
} from '@rme-sdk/prosemirror-flat-list'
import { defaultMarkerGetter } from './input-rule/schema/to-dom'
import { ListAttributes } from './input-rule/types'

/**
 * A Remirror extension for creating lists. It's a simple wrapper around the API from `prosemirror-flat-list`.
 *
 * @public
 */
export class LineListExtension extends NodeExtension {
  static disableExtraAttributes = true

  get name() {
    return 'list' as const
  }

  createInputRules(): InputRule[] {
    return listInputRules
  }

  createTags() {
    return [ExtensionTag.Block]
  }

  createNodeSpec(): NodeExtensionSpec {
    // @ts-expect-error: incompatible type
    return createListSpec({ toDomParams: { nativeList: false, getMarkers: defaultMarkerGetter } })
  }

  createKeymap(): KeyBindings {
    const bindings: KeyBindings = {}
    for (const [key, command] of Object.entries(listKeymap)) {
      bindings[key] = convertCommand(command)
    }
    bindings['Tab'] = alwaysTrue(bindings['Mod-]'])
    bindings['Shift-Tab'] = alwaysTrue(bindings['Mod-['])
    return bindings
  }

  createExternalPlugins(): ProsemirrorPlugin[] {
    return createListPlugins({ schema: this.store.schema })
  }

  createCommands(): ExtensionCommandReturn {
    return {
      indentList: (props?: IndentListOptions) => {
        return convertCommand(createIndentListCommand(props))
      },
      dedentList: (props?: DedentListOptions) => {
        return convertCommand(createDedentListCommand(props))
      },

      unwrapList: (options?: UnwrapListOptions) => {
        return convertCommand(createUnwrapListCommand(options))
      },

      wrapInList: (getAttrs: ListAttributes | ((range: NodeRange) => ListAttributes | null)) => {
        return convertCommand(createWrapInListCommand<ListAttributes>(getAttrs))
      },

      moveList: (direction: 'up' | 'down') => {
        return convertCommand(createMoveListCommand(direction))
      },

      splitList: () => convertCommand(createSplitListCommand()),

      protectCollapsed: () => convertCommand(protectCollapsed),

      toggleCollapsed: (props?: ToggleCollapsedOptions) => {
        return convertCommand(createToggleCollapsedCommand(props))
      },

      toggleList: (attrs: ListAttributes) => {
        return convertCommand(createToggleListCommand(attrs))
      },
    }
  }

  public fromMarkdown() {
    return [
      {
        type: ParserRuleType.free,
        token: 'list_item_open',
        handler: (state: MarkdownParseState, token: Token): void => {
          switch (state.topContext()) {
            case 'ordered_list':
              const token = state.topContextToken()
              let startOrder
              if (token?.type === 'ordered_list_open') {
                token?.attrs?.some(([name, value]) => {
                  if (name === 'order') {
                    startOrder = parseInt(value, 10)
                    state.closeContextToken()
                    return true
                  }
                  return false
                })
              }

              state.openNode(this.type, {
                kind: 'ordered',
                order: startOrder,
              } satisfies ListAttributes)
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
      // If node has custom order attribute, use it (consistent with CSS)
      // Otherwise use counter value which is already calculated correctly in serializer
      // to match CSS counter logic (resets when previous sibling is not an ordered list)
      const order = attrs.order != null ? attrs.order : counter
      firstDelim = `${order}. `
    } else if (attrs.kind === 'task') {
      firstDelim = attrs.checked ? '- [x] ' : '- [ ] '
    } else if (attrs.kind === 'bullet') {
      firstDelim = '- '
    }

    state.wrapBlock('  ', firstDelim, node, () =>
      state.renderContent(node),
    )
  }
}

/**
 * Wrap the giving command function so that it always returns `true`. This is
 * useful when we want pressing `Tab` and `Shift-Tab` won't blur the editor even
 * if the keybinding command returns `false`
 *
 * @public
 */
export function alwaysTrue<T extends unknown[]>(
  func: (...args: T) => boolean,
): (...args: T) => boolean {
  return (...args) => {
    func(...args)
    return true
  }
}

export function isOrderedListNode(node: ProsemirrorNode): boolean {
  return node.type.name === 'list' && (node.attrs as ListAttributes).kind === 'ordered'
}

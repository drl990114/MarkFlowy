import { NodeSerializerOptions, ParserRuleType } from '@/editor/transform'
import type {
  ApplySchemaAttributes,
  KeyBindings,
  NodeExtensionSpec,
  NodeSpecOverride,
} from '@rme-sdk/core'
import { extension, ExtensionTag, NodeExtension } from '@rme-sdk/core'
import { Token } from 'markdown-it/index.js'

@extension({
  defaultOptions: {},
  staticKeys: [],
  handlerKeys: [],
  customHandlerKeys: [],
})
export class ReferenceLabelExtension extends NodeExtension {
  get name() {
    return 'reference_label' as const
  }

  createTags() {
    return [ExtensionTag.InlineNode]
  }

  createNodeSpec(extra: ApplySchemaAttributes, override: NodeSpecOverride): NodeExtensionSpec {
    return {
      inline: true,
      group: 'reference_inline',
      content: 'text*',
      ...override,
      attrs: {
        ...extra.defaults(),
      },
      toDOM: (node) => {
        return [
          'span',
          {
            ...extra.dom(node),
            class: 'reference-definition-node__label',
          },
          // 为了阻止 prosemirror 的默认删除行为
          ['span', { contenteditable: 'false', disabled: 'true' }, '\u200B'],
          ['span', {}, 0],
          ['span', { contenteditable: 'false', disabled: 'true' }, '\u200B'],
        ]
      },
    }
  }

  fromMarkdown() {
    return [
      {
        type: ParserRuleType.inline,
        token: 'reference_label',
        getText: (tok: Token) => tok.content,
      },
    ] as const
  }

  toMarkdown({ state, node }: NodeSerializerOptions) {
    state.write('[')
    state.text(node.textContent || '')
    state.write(']: ')
  }

  createKeymap(): KeyBindings {
    return {
      Backspace: ({ state, dispatch }) => {
        const { selection } = state
        const { $from } = selection

        if ($from.parent.type.name !== this.name) {
          return false
        }

        if ($from.parent.textContent.length === 0) {
          let parentNode = null
          let parentPos = -1

          for (let depth = $from.depth - 1; depth >= 0; depth--) {
            const node = $from.node(depth)
            if (node.type.name === 'reference_def') {
              parentNode = node
              parentPos = $from.start(depth)
              break
            }
          }

          if (parentNode && parentPos !== -1 && dispatch) {
            dispatch(state.tr.delete(parentPos, parentPos + parentNode.nodeSize))
            return true
          }
        }

        return false
      },
    }
  }
}

@extension({
  defaultOptions: {},
  staticKeys: [],
  handlerKeys: [],
  customHandlerKeys: [],
})
export class ReferenceHrefExtension extends NodeExtension {
  get name() {
    return 'reference_href' as const
  }

  createTags() {
    return [ExtensionTag.InlineNode]
  }

  createNodeSpec(extra: ApplySchemaAttributes, override: NodeSpecOverride): NodeExtensionSpec {
    return {
      inline: true,
      group: 'reference_inline',
      content: 'text*',
      ...override,
      attrs: {
        ...extra.defaults(),
      },
      toDOM: (node) => {
        return [
          'span',
          {
            ...extra.dom(node),
            class: 'reference-definition-node__href',
          },
          0,
        ]
      },
    }
  }

  fromMarkdown() {
    return [
      {
        type: ParserRuleType.inline,
        token: 'reference_href',
        getText: (tok: Token) => tok.content,
      },
    ] as const
  }

  toMarkdown({ state, node }: NodeSerializerOptions) {
    state.text(`${node.textContent || ''} `)
  }
}

@extension({
  defaultOptions: {},
  staticKeys: [],
  handlerKeys: [],
  customHandlerKeys: [],
})
export class ReferenceTitleExtension extends NodeExtension {
  get name() {
    return 'reference_title' as const
  }

  createTags() {
    return [ExtensionTag.InlineNode]
  }

  createNodeSpec(extra: ApplySchemaAttributes, override: NodeSpecOverride): NodeExtensionSpec {
    return {
      inline: true,
      group: 'reference_inline',
      content: 'text*',
      ...override,
      attrs: {
        ...extra.defaults(),
      },
      toDOM: (node) => {
        return [
          'span',
          {
            ...extra.dom(node),
            class: 'reference-definition-node__title',
          },
          0,
        ]
      },
    }
  }

  fromMarkdown() {
    return [
      {
        type: ParserRuleType.inline,
        token: 'reference_title',
        getText: (tok: Token) => tok.content,
      },
    ] as const
  }

  toMarkdown({ state, node }: NodeSerializerOptions) {
    if (node.textContent) {
      state.write('"')
      state.text(node.textContent || '')
      state.write('"')
    }
  }
}

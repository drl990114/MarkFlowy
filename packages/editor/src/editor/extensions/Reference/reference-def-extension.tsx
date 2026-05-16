import type {
  ApplySchemaAttributes,
  EditorState,
  InputRule,
  NodeExtensionSpec,
  NodeSpecOverride,
} from '@rme-sdk/core'
import {
  extension,
  ExtensionTag,
  findParentNodeOfType,
  isElementDomNode,
  NodeExtension,
  nodeInputRule,
} from '@rme-sdk/core'
import { Decoration, DecorationSet } from '@rme-sdk/pm/view'
import { Token } from 'markdown-it/index.js'
import type { NodeSerializerOptions } from '../../transform'
import { ParserRuleType } from '../../transform'

export interface ReferenceDefinitionExtensionOptions {}

@extension<ReferenceDefinitionExtensionOptions>({
  defaultOptions: {},
  staticKeys: [],
  handlerKeys: [],
  customHandlerKeys: [],
})
export class ReferenceDefinitionExtension extends NodeExtension<ReferenceDefinitionExtensionOptions> {
  get name() {
    return 'reference_def' as const
  }

  createTags() {
    return [
      ExtensionTag.LastNodeCompatible,
      ExtensionTag.TextBlock,
      ExtensionTag.Block,
      ExtensionTag.FormattingNode,
    ]
  }

  createNodeSpec(extra: ApplySchemaAttributes, override: NodeSpecOverride): NodeExtensionSpec {
    return {
      group: 'reference',
      content: 'reference_label reference_href reference_title*',
      ...override,
      attrs: {
        ...extra.defaults(),
        label: { default: '' },
        href: { default: '' },
        title: { default: '' },
      },
      parseDOM: [
        {
          tag: 'div[data-reference-definition]',
          getAttrs: (node) => {
            if (!isElementDomNode(node)) {
              return false
            }

            const label = node.getAttribute('data-reference-label') || ''
            const href = node.getAttribute('data-reference-href') || ''
            const title = node.getAttribute('data-reference-title') || ''

            return {
              ...extra.parse(node),
              label,
              href,
              title,
            }
          },
        },
        ...(override.parseDOM ?? []),
      ],
      toDOM: (node) => {
        return [
          'div',
          {
            ...extra.dom(node),
            class: 'reference-def',
          },
          0,
        ]
      },
    }
  }

  createDecorations(state: EditorState): DecorationSet {
    const found = findParentNodeOfType({ types: this.type, selection: state.selection })
    if (!found) {
      return DecorationSet.empty
    }

    return DecorationSet.create(state.doc, [
      Decoration.node(found.pos, found.pos + found.node.nodeSize, { class: 'rme-block-focus' }),
    ])
  }

  createInputRules(): InputRule[] {
    return [
      nodeInputRule({
        regexp: /^\[([^\]]*)\]:\s*([^\s"]+(:\s+[^\s"]+)*)?(?:\s+"(.*?)")?/,
        type: this.type,
        getAttributes: (match: string[]) => {
          const [, label, ref, title] = match
          console.log('matchmatch', match)
          return { label, ref, title }
        },
      }),
    ]
  }

  public fromMarkdown() {
    return [
      {
        type: ParserRuleType.block,
        node: this.name,
        token: 'reference_def',
        hasOpenClose: true,
        getAttrs: (token: Token) => {
          return {
            label: token.attrs?.[0]?.[1] || '',
            href: token.attrs?.[1]?.[1] || '',
            title: token.attrs?.[2]?.[1] || '',
          }
        },
      },
    ] as const
  }

  public toMarkdown({ state, node }: NodeSerializerOptions) {
    state.renderInline(node)
    state.closeBlock(node)
    return
  }
}

import type { ApplySchemaAttributes, InputRule, NodeExtensionSpec, NodeSpecOverride, NodeViewMethod, ProsemirrorAttributes } from '@rme-sdk/core'
import { extension, ExtensionTag, NodeExtension, nodeInputRule, omitExtraAttributes } from '@rme-sdk/core'
import { getInlineMathInputRule } from '../../inline-input-regex'
import type { NodeSerializerOptions } from '../../transform'
import { ParserRuleType } from '../../transform'
import { MathInlineView } from './math-inline-nodeview'

export interface MathInlineAttributes {
  tex: string
}

export type MathInlineNodeAttrs = ProsemirrorAttributes<MathInlineAttributes>

@extension({
  defaultOptions: {},
})
export class MathInlineExtension extends NodeExtension {
  static disableExtraAttributes = true
  get name() {
    return 'math_inline' as const
  }

  createTags() {
    return [ExtensionTag.InlineNode]
  }

  createNodeSpec(extra: ApplySchemaAttributes, override: NodeSpecOverride): NodeExtensionSpec {
    return {
      inline: true,
      atom: true,
      selectable: true,
      // disallow marks on the inline atom similar to html-inline-node
      marks: '',
      ...override,
      attrs: {
        ...extra.defaults(),
        tex: { default: '' },
        fromInput: { default: false },
      },
      parseDOM: [
        {
          tag: 'span[data-type="math-inline"]',
          getAttrs: (dom) => {
            const el = dom as HTMLElement
            return { ...extra.parse(dom), tex: el.getAttribute('data-tex') ?? '' }
          },
        },
        ...(override.parseDOM ?? []),
      ],
      toDOM: (node) => {
        const attrs = omitExtraAttributes(node.attrs, extra)
        return ['span', { ...extra.dom(node), 'data-type': 'math-inline', 'data-tex': attrs.tex }]
      },
    }
  }

  createInputRules(): InputRule[] {
    return getInlineMathInputRule(this.type).map(nodeInputRule)
  }

  public fromMarkdown() {
    return [
      {
        type: ParserRuleType.inline,
        token: 'math_inline',
        node: this.name,
        getAttrs: (tok: any) => {
          return { tex: tok.attrs?.tex || '' }
        },
      },
    ] as const
  }

  public toMarkdown({ state, node }: NodeSerializerOptions) {
    const tex = (node.attrs as any).tex as string
    state.text(`$${tex}$`, false)
  }

  createNodeViews(): NodeViewMethod | Record<string, NodeViewMethod> {
    return (node, view, getPos) => new MathInlineView(node, view, getPos)
  }
}



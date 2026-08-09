import type {
  ApplySchemaAttributes,
  CommandFunction,
  NodeExtensionSpec,
  NodeSpecOverride,
  NodeViewMethod
} from '@rme-sdk/sdk/core'
import { convertCommand, extension, isElementDomNode, NodeExtension, nodeInputRule } from '@rme-sdk/sdk/core'
import type { ProsemirrorNode } from '@rme-sdk/sdk/pm'
import { setBlockType } from '@rme-sdk/sdk/pm/commands'
import type { InputRule } from '@rme-sdk/sdk/pm/inputrules'
import { TextSelection } from '@rme-sdk/sdk/pm/state'
import type { NodeSerializerOptions } from '../../transform'
import { ParserRuleType } from '../../transform'
import {
  createMermaidRenderer,
  type LivePreviewBlockCommonOptions,
  LivePreviewNodeView,
} from '../LivePreviewBlock'

export type MermaidExtensionOptions = LivePreviewBlockCommonOptions
@extension<MermaidExtensionOptions>({
  defaultOptions: {
    customCopyFunction: undefined,
    codemirrorExtensions: undefined,
    behavior: undefined,
  },
  staticKeys: [],
  handlerKeys: [],
  customHandlerKeys: [],
})
export class MermaidBlockExtension extends NodeExtension<MermaidExtensionOptions> {
  get name() {
    return 'mermaid_node' as const
  }

  createNodeSpec(extra: ApplySchemaAttributes, override: NodeSpecOverride): NodeExtensionSpec {
    return {
      group: 'block',
      content: 'text*',
      defining: true,
      ...override,
      code: true,
      marks: '',
      attrs: {
        ...extra.defaults(),
      },
      parseDOM: [
        {
          tag: 'pre[data-type="mermaid"]',
          priority: 60,
          getAttrs: (node) => (isElementDomNode(node) ? extra.parse(node) : false),
        },
        ...(override.parseDOM ?? []),
      ],
      toDOM(node) {
        return ['pre', { ...extra.dom(node), 'data-type': 'mermaid' }, 0]
      },
      isolating: true,
    }
  }

  createNodeViews(): NodeViewMethod {
    return (node: ProsemirrorNode, view, getPos) => {
      return new LivePreviewNodeView({
        node,
        view,
        getPos: getPos as () => number,
        renderer: createMermaidRenderer({
          codemirrorExtensions: this.options.codemirrorExtensions,
        }),
        customCopyFunction: this.options.customCopyFunction,
        behavior: this.options.behavior,
      })
    }
  }

  createMermaidBlock = (): CommandFunction => convertCommand(setBlockType(this.type))

  createInputRules(): InputRule[] {
    const rules: InputRule[] = [
      nodeInputRule({
        regexp: /^```mermaid$/,
        type: this.type,
        beforeDispatch: ({ tr, start }) => {
          const $pos = tr.doc.resolve(start)
          tr.setSelection(TextSelection.near($pos))
        },
      }),
    ]

    return rules
  }

  createCommands() {
    return {
      createMermaidBlock: this.createMermaidBlock,
    }
  }

  public fromMarkdown() {
    return [
      {
        type: ParserRuleType.block,
        token: 'mermaid_node',
        node: this.name,
        hasOpenClose: false,
      },
    ] as const
  }

  public toMarkdown({ state, node }: NodeSerializerOptions) {
    state.write('```mermaid\n')
    state.text(node.textContent, false)
    state.text('\n')
    state.write('```')
    state.closeBlock(node)
    state.ensureNewLine()
  }
}

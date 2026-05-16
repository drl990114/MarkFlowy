import { Extension } from '@codemirror/state'
import type {
  ApplySchemaAttributes,
  CommandFunction,
  NodeExtensionSpec,
  NodeSpecOverride,
  NodeViewMethod
} from '@rme-sdk/core'
import { convertCommand, extension, isElementDomNode, NodeExtension, nodeInputRule } from '@rme-sdk/core'
import type { ProsemirrorNode } from '@rme-sdk/pm'
import { setBlockType } from '@rme-sdk/pm/commands'
import type { InputRule } from '@rme-sdk/pm/inputrules'
import { TextSelection } from '@rme-sdk/pm/state'
import type { NodeSerializerOptions } from '../../transform'
import { ParserRuleType } from '../../transform'
import { CustomCopyFunction } from '../CodeMirror/codemirror-types'
import { MermaidNodeView } from './mermaid-view'

export interface MermaidExtensionOptions {
  customCopyFunction?: CustomCopyFunction
  codemirrorExtensions?: Extension[]
}
@extension<MermaidExtensionOptions>({
  defaultOptions: {
    customCopyFunction: undefined,
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
          tag: 'pre',
          getAttrs: (node) => (isElementDomNode(node) ? extra.parse(node) : false),
        },
        ...(override.parseDOM ?? []),
      ],
      toDOM() {
        return ['pre', { 'data-type': 'mermaid' }, 0]
      },
      isolating: true,
    }
  }

  createNodeViews(): NodeViewMethod {
    return (node: ProsemirrorNode, view, getPos) => {
      return new MermaidNodeView(node, view, getPos as () => number, this.options)
    }
  }

  createMermaidBlock = (): CommandFunction => convertCommand(setBlockType(this.type))

  createInputRules(): InputRule[] {
    const rules: InputRule[] = [
      nodeInputRule({
        regexp: /^```mermaid$/,
        type: this.type,
        beforeDispatch: ({ tr, start, match }) => {
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

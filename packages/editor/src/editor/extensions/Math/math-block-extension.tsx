import { Extension } from '@codemirror/state'
import type {
  ApplySchemaAttributes,
  CommandFunction,
  InputRule,
  NodeExtensionSpec,
  NodeSpecOverride,
  NodeViewMethod
} from '@rme-sdk/core'
import { convertCommand, extension, ExtensionTag, NodeExtension, nodeInputRule } from '@rme-sdk/core'
import { setBlockType } from '@rme-sdk/pm/commands'
import type { NodeSerializerOptions } from '../../transform'
import { ParserRuleType } from '../../transform'
import { CustomCopyFunction } from '../CodeMirror/codemirror-types'
import { createMathRenderer, LivePreviewNodeView } from '../LivePreviewBlock'

export interface MathBlockExtensionOptions {
  customCopyFunction?: CustomCopyFunction
  codemirrorExtensions?: Extension[]
}
@extension({
  defaultOptions: {},
})
export class MathBlockExtension extends NodeExtension<MathBlockExtensionOptions> {
  get name() {
    return 'math_block' as const
  }

  createTags() {
    return [ExtensionTag.Block]
  }

  createNodeSpec(extra: ApplySchemaAttributes, override: NodeSpecOverride): NodeExtensionSpec {
    return {
      group: 'block',
      content: 'text*',
      defining: true,
      code: true,
      marks: '',
      ...override,
      attrs: {
        ...extra.defaults(),
        tex: { default: '' },
        fromInput: { default: false },
      },
      parseDOM: [
        {
          tag: 'div[data-type="math-block"]',
          getAttrs: (dom) => extra.parse(dom),
        },
        ...(override.parseDOM ?? []),
      ],
      toDOM: () => ['div', { 'data-type': 'math-block' }, 0],
      isolating: true,
    }
  }

  createNodeViews(): NodeViewMethod | Record<string, NodeViewMethod> {
    return (node, view, getPos) =>
      new LivePreviewNodeView({
        node,
        view,
        getPos: getPos as () => number,
        renderer: createMathRenderer({
          codemirrorExtensions: this.options.codemirrorExtensions,
        }),
        customCopyFunction: this.options.customCopyFunction,
        openOnMount: Boolean((node.attrs as any).fromInput),
      })
  }

  createMathBlock =
    (attributes: { tex?: string; fromInput?: boolean } = {}): CommandFunction =>
      convertCommand(setBlockType(this.type, { tex: '', fromInput: true, ...attributes }))

  createInputRules(): InputRule[] {
    return [
      nodeInputRule({
        regexp: /^\$\$$/,
        type: this.type,
        getAttributes: (match) => {
          return { tex: match[1] ?? '', fromInput: true }
        },
      }),
    ]
  }

  createCommands() {
    return {
      createMathBlock: this.createMathBlock,
    }
  }

  public fromMarkdown() {
    return [
      {
        type: ParserRuleType.block,
        token: 'math_block',
        node: this.name,
        hasOpenClose: false,
        getAttrs: (tok: any) => {
          return { tex: tok.attrs?.tex || '' }
        },
      },
    ] as const
  }

  public toMarkdown({ state, node }: NodeSerializerOptions) {
    state.write('$$\n')
    const tex = node.textContent || node.attrs.tex || ''
    state.text(tex, false)

    if (!tex.endsWith('\n')) {
      state.text('\n')
    }

    state.write('$$')
    state.closeBlock(node)
    state.ensureNewLine()
  }
}

import type { NodeSerializerOptions } from '../../transform'
import { ParserRuleType } from '../../transform'
import type {
  ApplySchemaAttributes,
  NodeExtensionSpec,
  NodeSpecOverride,
  NodeViewMethod,
} from '@remirror/core'
import { NodeExtension } from '@remirror/core'
import type { ProsemirrorNode } from '@remirror/pm'
import { HtmlNodeView } from './html-node-view'

export class LineHtmlBlockExtension extends NodeExtension {
  get name() {
    return 'html_block' as const
  }

  createNodeSpec(extra: ApplySchemaAttributes, override: NodeSpecOverride): NodeExtensionSpec {
    return {
      group: 'block',
      content: 'text*',
      atom: true,
      code: true,
      ...override,
      attrs: {
        ...extra.defaults(),
      },
      toDOM: () => ['html_block', { class: 'math-node' }, 0],
      parseDOM: [
        {
          tag: 'html_block', // important!
        },
      ],
    }
  }

  createNodeViews(): NodeViewMethod {
    return (node: ProsemirrorNode, view, getPos) => {
      return new HtmlNodeView(node, view, getPos as () => number)
    }
  }

  public fromMarkdown() {
    return [
      {
        type: ParserRuleType.block,
        token: 'html_block',
        node: this.name,
        hasOpenClose: false,
      },
    ] as const
  }

  public toMarkdown({ state, node }: NodeSerializerOptions) {
    state.write('\n')
    state.text(node.textContent, false)
    state.text('\n')
    state.closeBlock(node)
    state.ensureNewLine()
  }
}

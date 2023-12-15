import { arrayExclude } from './../../utils/common'
import type { NodeSerializerOptions } from '../../transform'
import { ParserRuleType } from '../../transform'
import type {
  ApplySchemaAttributes,
  NodeExtensionSpec,
  NodeSpecOverride,
  NodeViewMethod,
  PrioritizedKeyBindings,
} from '@remirror/core'
import { NodeExtension, isElementDomNode, nodeInputRule } from '@remirror/core'
import type { ProsemirrorNode } from '@remirror/pm'
import { HtmlNodeView } from './html-block-view'
import type { InputRule } from '@remirror/pm/inputrules'
import { TextSelection } from '@remirror/pm/state'
import block_names from 'markdown-it/lib/common/html_blocks'
import { arrowHandler } from '../CodeMirror/codemirror-utils'
import { needSplitInlineHtmlTokenTags } from '@/transform/markdown-it-html-inline'

export class LineHtmlBlockExtension extends NodeExtension {
  get name() {
    return 'html_block' as const
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
        language: { default: 'html' },
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
        return ['pre', ['code', 0]]
      },
      isolating: true,
    }
  }

  createNodeViews(): NodeViewMethod {
    return (node: ProsemirrorNode, view, getPos) => {
      return new HtmlNodeView(node, view, getPos as () => number)
    }
  }

  createInputRules(): InputRule[] {
    const rules: InputRule[] = [
      nodeInputRule({
        regexp: new RegExp(
          '^</?(' +
            arrayExclude(block_names, needSplitInlineHtmlTokenTags).join('|') +
            ')(?=(\\s|/?>|$))',
          'i',
        ),
        type: this.type,
        beforeDispatch: ({ tr, start, match }) => {
          const $pos = tr.doc.resolve(start)
          tr.setSelection(TextSelection.near($pos))
          tr.insertText(match[0])
        },
      }),
    ]

    return rules
  }

  createKeymap(): PrioritizedKeyBindings {
    return {
      ArrowLeft: arrowHandler('left'),
      ArrowRight: arrowHandler('right'),
      ArrowUp: arrowHandler('up'),
      ArrowDown: arrowHandler('down'),
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

import type { NodeSerializerOptions } from '../../transform'
import { ParserRuleType } from '../../transform'
import type {
  ApplySchemaAttributes,
  EditorState,
  NodeExtensionSpec,
  NodeSpecOverride,
  NodeViewMethod,
} from '@remirror/core'
import { NodeExtension, findParentNodeOfType, nodeInputRule } from '@remirror/core'
import { Decoration, DecorationSet } from '@remirror/pm/view'
import type { EditorView, InputRule, ProsemirrorNode } from '@remirror/pm'
import { computeChange } from '../CodeMIrror/codemirror-node-view'
import { TextSelection } from '@remirror/pm/state'

export class LineHtmlBlockExtension extends NodeExtension {
  get name() {
    return 'html_block' as const
  }

  createNodeSpec(extra: ApplySchemaAttributes, override: NodeSpecOverride): NodeExtensionSpec {
    return {
      group: 'block',
      content: 'text*',
      code: true,
      defining: true,
      ...override,
      attrs: {
        ...extra.defaults(),
      },
    }
  }

  createNodeViews(): NodeViewMethod {
    return (node: ProsemirrorNode) => {
      const container = document.createElement('div')

      try {
        const domParser = new DOMParser()
        const doc = domParser.parseFromString(node.textContent || '', 'text/html')
        container.innerHTML = doc.body.innerHTML ?? ''
      } catch (error) {
        container.innerHTML = node.textContent ?? ''
      }

      container.classList.add('html-block')

      const contentDOM = document.createElement('div')

      contentDOM.classList.add('html-block__content')
      contentDOM.style.display = 'none'
      container.append(contentDOM)

      // return new HTMLNodeView(node, view)
      return {
        dom: container,
        contentDOM,
        update: (newNode: ProsemirrorNode) => {
          if (newNode.type !== node.type) {
            return false
          }
          container.innerHTML = newNode.textContent ?? ''
          container.append(contentDOM)
          return true
        },
      }
    }
  }

  createInputRules(): InputRule[] {
    const regexp = /<(\"[^\"]*\"|'[^']*'|[^'\">])*>/

    return [
      nodeInputRule({
        regexp,
        type: this.type,
        beforeDispatch: ({ tr, start }) => {
          const $pos = tr.doc.resolve(start)
          tr.setSelection(TextSelection.near($pos))
        },
      }),
    ]
  }

  createDecorations(state: EditorState): DecorationSet {
    const found = findParentNodeOfType({ types: this.type, selection: state.selection })
    if (!found) {
      return DecorationSet.empty
    }

    const input = document.createElement('input')
    const create = (view: EditorView, getPos: () => number | undefined) => {
      input.value = found.node.textContent ?? ''

      let oldValue = found.node.textContent

      input.addEventListener('focus', () => {
        input.classList.add('html-block__decoration--focus')
      })

      input.addEventListener('blur', () => {
        input.classList.remove('html-block__decoration--focus')
      })

      input.addEventListener('input', (e) => {
        const newValue = (e.target as HTMLInputElement)?.value ?? ''
        const change = computeChange(oldValue, newValue)
        const pos = getPos()

        if (pos !== undefined && change) {
          const start = pos + 1
          let transaction
          if (change.from === change.to) {
            transaction = view.state.tr.insertText(
              change.text,
              start + change.from,
              start + change.to,
            )
          } else {
            transaction = view.state.tr.replaceWith(
              start + change.from,
              start + change.to,
              change.text ? found.node.type.schema.text(change.text) : [],
            )
          }
          view.dispatch(transaction)

          oldValue = newValue
        }
      })

      const container = document.createElement('div')
      container.classList.add('html-block__decoration')
      container.append(input)

      return container
    }

    const destroy = () => {
      input.remove()
    }

    const deco = Decoration.widget(found.pos, create, {
      ignoreSelection: true,
      stopEvent: () => true,
      key: 'language-menu',
      destroy,
    })

    return DecorationSet.create(state.doc, [deco])
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

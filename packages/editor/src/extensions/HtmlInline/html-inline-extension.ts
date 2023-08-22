import type { MarkExtensionSpec, NodeViewMethod, PrioritizedKeyBindings } from 'remirror'
import { MarkExtension, convertCommand } from 'remirror'
import type { EditorState, Transaction } from "@remirror/pm/state"
import { Selection } from '@remirror/pm/state'

export class LineHtmlInlineExtension extends MarkExtension {
  static disableExtraAttributes = true

  get name() {
    return 'mdHtmlInline' as const
  }

  createMarkSpec(): MarkExtensionSpec {
    return {
      attrs: {
        depth: { default: 0 },
        key: {
          default: "",
        },
        htmlText: {
          default: '',
        }
      },
      toDOM: (mark) =>  [
        'span',
       {
         ...mark.attrs,
       },
       0,
     ],
    }
  }

  createNodeViews(): NodeViewMethod | Record<string, NodeViewMethod> {
    return (node) => {
      const container = document.createElement('span')

      const domParser = new DOMParser()
      const doc = domParser.parseFromString(node.attrs.htmlText || '', 'text/html')

      doc.body.childNodes.forEach((child) => {
        container.appendChild(child)
      })

      const contentDom = document.createElement('span')
      container.appendChild(contentDom)
      container.setAttribute('key', node.attrs.key)
      contentDom.setAttribute('class', 'md-html-inline')

      return {
        dom: container,
        contentDOM: contentDom,
      }
    }
  }

  createKeymap(): PrioritizedKeyBindings {
      return {
        Enter: convertCommand((state: EditorState, dispatch, view) => {
          if (!view) {
            return false
          }
          const tr: Transaction = state.tr
          
          if (!(tr.selection.empty)) {
            return false
          }
      
          const $head = tr.selection.$head
          const nextPos = Selection.near(tr.doc.resolve($head.pos), 0)
          const curMark = nextPos.$head.marksAcross($head)?.[0]
          if (nextPos.$head && curMark?.type.name === 'mdHtmlInline') {
            dispatch?.(tr.setSelection(nextPos))
            return true
          }
      
          return false
        })
      }
  }
}

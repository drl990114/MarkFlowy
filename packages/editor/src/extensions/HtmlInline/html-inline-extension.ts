import type { MarkExtensionSpec, NodeViewMethod } from 'remirror'
import { MarkExtension } from 'remirror'

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
}

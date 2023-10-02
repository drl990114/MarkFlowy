import { isImageElement } from '@/utils/html'
import type { MarkExtensionSpec, NodeViewMethod } from 'remirror'
import { MarkExtension, extension } from 'remirror'

type LineHtmlInlineExtensionOptions = {
  handleViewImgSrcUrl?: (src: string) => Promise<string>
}

@extension<LineHtmlInlineExtensionOptions>({
  defaultOptions: {
    handleViewImgSrcUrl: async (src: string) => src,
  },
})
export class LineHtmlInlineExtension extends MarkExtension<LineHtmlInlineExtensionOptions> {
  static disableExtraAttributes = true

  get name() {
    return 'mdHtmlInline' as const
  }

  createMarkSpec(): MarkExtensionSpec {
    return {
      attrs: {
        depth: { default: 0 },
        key: {
          default: '',
        },
        htmlText: {
          default: '',
        },
      },
      toDOM: (mark) => [
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
        if (isImageElement(child) && child.src && this.options.handleViewImgSrcUrl) {
          let targetUrl = child.src
          
          if (child.src.includes(location.origin)) {
            targetUrl = child.src.split(location.origin)[1]
          }

          this.options.handleViewImgSrcUrl(targetUrl).then((newHref) => {
            child.src = newHref
          })
        }
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

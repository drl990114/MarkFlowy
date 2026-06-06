import { html } from '@codemirror/lang-html'
import type { Extension as CodeMirrorExtension } from '@codemirror/state'
import type { ExtensionsOptions } from '../../index'
import { isImageElement } from '../../../utils/html'
import type { LivePreviewRenderer } from '../live-preview-types'

export function removeNewlines(str: string) {
  return str.replace(/\n+|\t/g, '')
}

export function createHtmlRenderer(options: {
  codemirrorExtensions?: CodeMirrorExtension[]
  handleViewImgSrcUrl?: ExtensionsOptions['handleViewImgSrcUrl']
}): LivePreviewRenderer {
  return {
    languageName: 'html',
    displayName: 'HTML',
    className: 'mf-live-preview-html',
    getCodeMirrorExtensions: () => [html(), ...(options.codemirrorExtensions ?? [])],
    render: (content, container) => {
      const source = removeNewlines(content).trim()
      container.replaceChildren()

      if (!source) {
        return
      }

      const domParser = new DOMParser()
      const doc = domParser.parseFromString(source, 'text/html')

      if (options.handleViewImgSrcUrl) {
        const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT)
        let child = walker.nextNode()
        while (child) {
          if (isImageElement(child) && child.src) {
            let targetUrl = child.src
            if (child.src.includes(location.origin)) {
              targetUrl = child.src.split(location.origin)[1]
            }
            void options.handleViewImgSrcUrl(targetUrl).then((newHref) => {
              child.src = newHref
            })
          }
          child = walker.nextNode()
        }
      }

      container.append(...Array.from(doc.body.childNodes))
    },
  }
}

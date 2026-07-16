import { html } from '@codemirror/lang-html'
import type { Extension as CodeMirrorExtension } from '@codemirror/state'
import MarkdownIt from 'markdown-it'
import type { ExtensionsOptions } from '../../index'
import { isImageElement } from '../../../utils/html'
import {
  clearPreviewImageSource,
  getPreviewImageSource,
  sanitizeMarkdownHtml,
} from '../../../utils/sanitize-html'
import type { LivePreviewRenderer } from '../live-preview-types'

const markdownHtmlRenderer = MarkdownIt('commonmark', { html: true })
const whitespacePreservingTags = new Set(['PRE', 'CODE', 'TEXTAREA', 'SCRIPT', 'STYLE'])

function hasWhitespacePreservingParent(node: Node) {
  let parent = node.parentElement

  while (parent) {
    if (whitespacePreservingTags.has(parent.tagName)) {
      return true
    }
    parent = parent.parentElement
  }

  return false
}

function removeFormattingWhitespace(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const textNodesToRemove: Text[] = []
  let node = walker.nextNode()

  while (node) {
    const text = node.textContent || ''
    if (/^[\s]+$/.test(text) && /[\n\r\t]/.test(text) && !hasWhitespacePreservingParent(node)) {
      textNodesToRemove.push(node as Text)
    }
    node = walker.nextNode()
  }

  textNodesToRemove.forEach((textNode) => textNode.remove())
}

export function createHtmlRenderer(options: {
  codemirrorExtensions?: CodeMirrorExtension[]
  handleViewImgSrcUrl?: ExtensionsOptions['handleViewImgSrcUrl']
  preserveImageSources?: boolean
}): LivePreviewRenderer {
  return {
    languageName: 'html',
    displayName: 'HTML',
    className: 'mf-live-preview-html',
    getCodeMirrorExtensions: () => [html(), ...(options.codemirrorExtensions ?? [])],
    render: async (content, container) => {
      const source = content.trim()
      container.replaceChildren()

      if (!source) {
        return
      }

      const htmlContent = sanitizeMarkdownHtml(markdownHtmlRenderer.render(source), {
        preserveImageSources: Boolean(
          options.handleViewImgSrcUrl || options.preserveImageSources,
        ),
      })
      const domParser = new DOMParser()
      const doc = domParser.parseFromString(htmlContent, 'text/html')
      removeFormattingWhitespace(doc.body)
      const imageTasks: Promise<void>[] = []

      if (options.handleViewImgSrcUrl) {
        const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT)
        let child = walker.nextNode()
        while (child) {
          if (isImageElement(child) && getPreviewImageSource(child)) {
            const image = child
            let targetUrl = getPreviewImageSource(image) || ''
            if (targetUrl.includes(location.origin)) {
              targetUrl = targetUrl.split(location.origin)[1]
            }
            imageTasks.push(
              options.handleViewImgSrcUrl(targetUrl).then((newHref) => {
                image.src = newHref
                clearPreviewImageSource(image)
              }).catch(() => {
                image.removeAttribute('src')
                clearPreviewImageSource(image)
              }),
            )
          }
          child = walker.nextNode()
        }
      }

      if (imageTasks.length) {
        await Promise.all(imageTasks)
      }
      container.append(...Array.from(doc.body.childNodes))
    },
  }
}

import { html } from '@codemirror/lang-html'
import { Compartment, Extension } from '@codemirror/state'
import type { EditorView as CodeMirrorEditorView } from '@codemirror/view'
import type { ProsemirrorNode } from '@rme-sdk/main'
import { type EditorSchema } from '@rme-sdk/main'
import type { EditorView } from '@rme-sdk/pm/view'
import type { Node as ProseNode } from 'prosemirror-model'
import type { NodeView } from 'prosemirror-view'
import { MfCodemirrorView } from '../../codemirror/codemirror'
import { addLabelToDom } from '../../utils/dom'
import { isImageElement } from '../../utils/html'
import { LineHtmlBlockExtensionOptions } from './html-block-types'

export function removeNewlines(str: string) {
  return str.replace(/\n+|\t/g, '')
}

export class HtmlNodeView implements NodeView {
  // nodeview params
  private _node: ProseNode
  private _outerView: EditorView
  private _getPos: () => number

  // nodeview dom
  dom: HTMLElement
  private _htmlRenderElt: HTMLElement | undefined
  private _htmlSrcElt: HTMLElement | null = null
  private _innerView: CodeMirrorEditorView | undefined
  private readonly schema: EditorSchema
  private readonly languageConf: Compartment
  mfCodemirrorView?: MfCodemirrorView
  destroying = false
  options: LineHtmlBlockExtensionOptions = {}

  constructor(
    node: ProseNode,
    view: EditorView,
    getPos: () => number,
    options?: LineHtmlBlockExtensionOptions,
  ) {
    // store arguments
    this._node = node
    this._outerView = view
    this._getPos = getPos
    this.schema = node.type.schema
    if (options) {
      this.options = { ...this.options, ...options }
    }

    // create dom representation of nodeview
    this.dom = document.createElement('div')
    this.dom.classList.add('html-node')

    this._htmlRenderElt = document.createElement('p')
    this._htmlRenderElt.textContent = ''
    this._htmlRenderElt.classList.add('html-node-render')

    const labelDom = addLabelToDom(this.dom, {
      labelName: 'HTML',
    })
    labelDom.addEventListener('click', () => this.ensureFocus())

    this.dom.appendChild(this._htmlRenderElt)

    this._htmlSrcElt = document.createElement('span')
    this._htmlSrcElt.classList.add('html-src', 'node-hide')

    this.languageConf = new Compartment()

    this.dom.appendChild(this._htmlSrcElt)

    this.renderHtml()
  }

  /**
   * Ensure focus on the inner editor whenever this node has focus.
   * This helps to prevent accidental deletions of html blocks.
   */
  ensureFocus() {
    if (this._outerView.hasFocus()) {
      if (this._innerView) {
        this._innerView.focus()
      } else {
        this.openEditor()
      }
    }
  }

  ignoreMutation = () => true

  update(node: ProsemirrorNode): boolean {
    this._node = node
    return !!this.mfCodemirrorView?.update(node)
  }

  // == Events ===================================== //
  stopEvent(): boolean {
    return true
  }

  // == Rendering ===================================== //

  renderHtml() {
    if (!this._htmlRenderElt) {
      return
    }

    // get tex string to render
    const content = removeNewlines(this.mfCodemirrorView?.content || this._node.textContent)
    const texString = content.trim()

    if (texString.length < 1) {
      while (this._htmlRenderElt.firstChild) {
        this._htmlRenderElt.firstChild.remove()
      }
      return
    } else {
      // ignore
    }

    try {
      while (this._htmlRenderElt.firstChild) {
        this._htmlRenderElt.firstChild.remove()
      }

      this._htmlRenderElt.classList.remove('node-hide')
      this._htmlRenderElt.classList.add('node-show')

      const domParser = new DOMParser()
      const doc = domParser.parseFromString(texString, 'text/html')

      const processNodes = (nodes: NodeList | HTMLCollection) => {
         const nodeArray = Array.from(nodes)
         nodeArray.forEach((child) => {
           if (isImageElement(child) && child.src && this.options.handleViewImgSrcUrl) {
             let targetUrl = child.src
             if (child.src.includes(location.origin)) {
               targetUrl = child.src.split(location.origin)[1]
             }
             void this.options.handleViewImgSrcUrl(targetUrl).then((newHref) => {
               child.src = newHref
            })
           }
           if (child.nodeType === Node.ELEMENT_NODE) {
             const element = child as Element
             if (element.children.length > 0) {
               processNodes(element.children)
             }
           }
           this._htmlRenderElt?.appendChild(child)
         })
       }

      processNodes(doc.body.childNodes)
    } catch (err) {}
  }

  setSelection(anchor: number, head: number): void {
    if (!this._innerView) {
      this.openEditor()
      this.mfCodemirrorView!.setSelection(anchor, head)
    } else {
      this.mfCodemirrorView?.setSelection(anchor, head)
    }
  }

  openEditor() {
    if (this._innerView) {
      throw Error('inner view should not exist!')
    }

    const codemirrorExtensions: Extension[] = [html()]
    if (this.options?.codemirrorExtensions) {
      codemirrorExtensions.push(...this.options.codemirrorExtensions)
    }
    this.mfCodemirrorView = new MfCodemirrorView({
      view: this._outerView,
      node: this._node,
      getPos: this._getPos,
      languageName: 'html',
      extensions: codemirrorExtensions,
      options: {
        useProsemirrorHistoryKey: true,
        codemirrorEditorViewConfig: {
          parent: this._htmlSrcElt!,
        },
        copyButton: {
          enabled: true,
          customCopyFunction: this.options?.customCopyFunction,
        },
      },
    })

    this._htmlSrcElt!.classList.remove('node-hide')
    this._innerView = this.mfCodemirrorView.cm
    this._htmlRenderElt?.classList.add('node-hide')

    const prevCursorPos: number = this._node.textContent.length || 0

    this.setSelection(prevCursorPos, prevCursorPos)

    this._innerView.focus()

    this._innerView.contentDOM.addEventListener('blur', () => {
      if (this.destroying) return
      this.closeEditor(true)
    })

    this.mfCodemirrorView.forwardSelection()
  }

  destroy() {
    this.destroying = true
    // close the inner editor without rendering
    this.closeEditor(false)
    // clean up dom elements
    if (this._htmlRenderElt) {
      this._htmlRenderElt.remove()
      delete this._htmlRenderElt
    }
    if (this._htmlSrcElt) {
      this._htmlSrcElt.remove()
      this._htmlSrcElt = null // fix for the error
    }

    this.dom.remove()
  }

  /**
   * Called when the inner ProseMirror editor should close.
   *
   * @param render Optionally update the rendered html after closing. (which
   *    is generally what we want to do, since the user is done editing!)
   */
  closeEditor(render: boolean = true) {
    if (this._innerView) {
      this._innerView.destroy()
      this._innerView = undefined
    }
    if (this.mfCodemirrorView) {
      this.mfCodemirrorView.destroy()
      this.mfCodemirrorView = undefined
    }

    if (render) {
      this.renderHtml()
    }
  }
}

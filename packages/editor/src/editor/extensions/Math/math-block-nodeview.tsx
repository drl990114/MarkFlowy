import { MfCodemirrorView } from '@/editor/codemirror'
import { Extension } from '@codemirror/state'
import type { EditorView as CodeMirrorEditorView } from '@codemirror/view'
import { Node as ProseNode } from '@rme-sdk/pm/model'
import { Decoration, EditorView, NodeView } from '@rme-sdk/pm/view'
import { latex } from 'codemirror-lang-latex'
import { addLabelToDom } from '../../utils/dom'
import { MathBlockExtensionOptions } from './math-block-extension'
import { tex2svgDisplay } from './mathjax'

export class MathBlockView implements NodeView {
  private _node: ProseNode
  private _outerView: EditorView
  private _getPos: () => number

  dom: HTMLElement
  private _renderElt: HTMLElement | undefined
  private _srcElt: HTMLElement | undefined
  private _innerView: CodeMirrorEditorView | undefined
  mfCodemirrorView?: MfCodemirrorView
  options?: MathBlockExtensionOptions

  constructor(
    node: ProseNode,
    view: EditorView,
    getPos: () => number,
    options: MathBlockExtensionOptions,
  ) {
    this._node = node
    this._outerView = view
    this._getPos = getPos
    this.options = options

    this.dom = document.createElement('div')
    this.dom.classList.add('math-block-nodeview')

    this._renderElt = document.createElement('div')
    this._renderElt.classList.add('math-block-render')
    this.dom.appendChild(this._renderElt)

    this._srcElt = document.createElement('div')
    this._srcElt.classList.add('html-src', 'node-hide')

    const labelDom = addLabelToDom(this.dom, {
      labelName: 'LaTex',
    })
    this.dom.appendChild(this._srcElt)

    labelDom.addEventListener('click', () => this.ensureFocus())

    if ((node.attrs as any).fromInput) {
      this.openEditor()
    } else {
      this.renderTex()
    }
  }

  destroy() {
    this.closeEditor(false)
    if (this._renderElt) {
      this._renderElt.remove()
      delete this._renderElt
    }
    if (this._srcElt) {
      this._srcElt.remove()
      this._srcElt = undefined
    }

    this.dom.remove()
  }

  ensureFocus() {
    if (this._outerView.hasFocus()) {
      if (this._innerView) {
        this._innerView.focus()
      } else {
        this.openEditor()
      }
    }
  }

  update(node: ProseNode, _decorations: readonly Decoration[]) {
    this._node = node
    return !!this.mfCodemirrorView?.update(node)
  }

  setSelection(anchor: number, head: number): void {
    if (!this._innerView) {
      this.openEditor()
      this.mfCodemirrorView!.setSelection(anchor, head)
    } else {
      this.mfCodemirrorView?.setSelection(anchor, head)
    }
  }

  stopEvent(): boolean {
    return true
  }

  ignoreMutation() {
    return true
  }

  private renderTex(preview = false) {
    if (!this._renderElt) return
    const content = this.mfCodemirrorView?.content || this._node.textContent

    const tex: string = content.trim()

    try {
      while (this._renderElt.firstChild) {
        this._renderElt.firstChild.remove()
      }

      const container = document.createElement('div')
      container.setAttribute('data-type', 'math-block')
      container.innerHTML = tex2svgDisplay(tex)

      let newRenderEl: HTMLElement = container
      if (container.childElementCount === 1 && container.firstElementChild) {
        newRenderEl = container.firstElementChild as HTMLElement
      }

      this._renderElt.replaceWith(newRenderEl)
      this._renderElt = newRenderEl

      this.dom.appendChild(this._renderElt)

      if (preview) {
        this._renderElt.classList.add('math-block-preview')
      } else {
        this._renderElt.classList.add('math-block-render')
        this._renderElt.classList.remove('math-block-preview')
      }
    } catch (err) {
      console.error(err)
      this._renderElt.classList.add('parse-error')
      this.dom.setAttribute('title', String(err))
    }
  }

  private openEditor = () => {
    if (this._innerView) return

    const currentTex: string = ((this._node.attrs as any).tex ?? '') as string

    const codemirrorExtensions: Extension[] = [latex()]
    if (this.options?.codemirrorExtensions) {
      codemirrorExtensions.push(...this.options.codemirrorExtensions)
    }
    this.mfCodemirrorView = new MfCodemirrorView({
      view: this._outerView,
      node: this._node,
      getPos: this._getPos,
      languageName: 'LaTeX',
      extensions: codemirrorExtensions,
      options: {
        useProsemirrorHistoryKey: true,
        codemirrorEditorViewConfig: {
          parent: this._srcElt!,
        },
        copyButton: {
          enabled: true,
          customCopyFunction: this.options?.customCopyFunction,
        },
      },
    })

    this._srcElt!.classList.remove('node-hide')
    this._innerView = this.mfCodemirrorView.cm
    this._renderElt?.classList.add('node-hide')

    const prevCursorPos: number = this._node.textContent.length || 0

    this.setSelection(prevCursorPos, prevCursorPos)

    this._innerView.focus()

    this._innerView.contentDOM.addEventListener('blur', () => {
      this.closeEditor(true)
    })

    this.mfCodemirrorView.forwardSelection()
  }

  private closeEditor = (render: boolean = true) => {
    if (this._innerView) {
      this._innerView.destroy()
      this._innerView = undefined
    }
    if (this.mfCodemirrorView) {
      this.mfCodemirrorView.destroy()
      this.mfCodemirrorView = undefined
    }

    if (render) {
      this.renderTex()
    }
  }
}

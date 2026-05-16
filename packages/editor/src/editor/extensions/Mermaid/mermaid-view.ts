import { Compartment } from '@codemirror/state'
import type { EditorView as CodeMirrorEditorView } from '@codemirror/view'
import type { ProsemirrorNode } from '@rme-sdk/core'
import { type EditorSchema } from '@rme-sdk/core'
import type { EditorView } from '@rme-sdk/pm/view'
import mermaid from 'mermaid'
import type { Node as ProseNode } from 'prosemirror-model'
import type { NodeView } from 'prosemirror-view'
import { MfCodemirrorView } from '../../codemirror/codemirror'
import { addLabelToDom } from '../../utils/dom'
import { eventBus } from '../../utils/eventbus'
import { isBrowser } from '../../utils/common'
import { minimalSetup } from '../CodeMirror/setup'
import { MermaidExtensionOptions } from './mermaid-extension'

/**
 * 确保每个视图都有一个唯一的ID
 */
export const renderCount = { count: 0 }

export class MermaidNodeView implements NodeView {
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

  renderViewId: string | null = null
  options?: MermaidExtensionOptions

  constructor(node: ProseNode, view: EditorView, getPos: () => number, options: MermaidExtensionOptions) {
    // store arguments
    this._node = node
    this._outerView = view
    this._getPos = getPos
    this.schema = node.type.schema
    this.options = options

    // create dom representation of nodeview
    this.dom = document.createElement('div')
    this.dom.classList.add('mermaid-node')

    this._htmlRenderElt = document.createElement('p')
    this._htmlRenderElt.textContent = ''
    this._htmlRenderElt.classList.add('html-node-render')

    const labelDom = addLabelToDom(this.dom, {
      labelName: 'Mermaid',
    })
    labelDom.addEventListener('click', () => this.ensureFocus())

    this.dom.appendChild(this._htmlRenderElt)

    this.dom.appendChild(this._htmlRenderElt)

    this._htmlSrcElt = document.createElement('span')
    this._htmlSrcElt.classList.add('mermaid-src', 'node-hide')

    this.languageConf = new Compartment()

    this.dom.appendChild(this._htmlSrcElt)

    this.renderHtml()
    eventBus.on('change-theme', this.changeTheme)
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
  changeTheme = () => {
    this.renderHtml()
  }

  renderHtml() {
    if (!this._htmlRenderElt || !isBrowser()) {
      return
    }

    // get tex string to render
    const content = this.mfCodemirrorView?.content || this._node.textContent

    try {
      this._htmlRenderElt.innerHTML = ''
      this._htmlRenderElt.classList.remove('node-hide')
      this._htmlRenderElt.classList.add('node-show')
      renderCount.count++

      const id = `mermaid-${renderCount.count}`
      mermaid
        .render(id, content)
        .then(({ svg, bindFunctions }) => {
          if (!this._htmlRenderElt) {
            return
          }
          this._htmlRenderElt.innerHTML = svg
          bindFunctions?.(this._htmlRenderElt)
        })
        .catch((err) => {
          if (isBrowser()) {
            document.getElementById('d' + id)?.remove()
          }
          console.error('渲染失败:', id, err)
        })
    } catch (err) {}
  }

  // == Inner Editor ================================== /
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

    this.mfCodemirrorView = new MfCodemirrorView({
      view: this._outerView,
      node: this._node,
      getPos: this._getPos,
      languageName: 'mermaid',
      extensions: this.options?.codemirrorExtensions || [minimalSetup],
      options: {
        useProsemirrorHistoryKey: true,
        codemirrorEditorViewConfig: {
          parent: this._htmlSrcElt!,
        },
        copyButton: {
          enabled: true,
          customCopyFunction: this.options?.customCopyFunction
        }
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

    eventBus.detach('change-theme', this.changeTheme)
  }

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

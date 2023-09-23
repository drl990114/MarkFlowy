import type { Node as ProseNode } from 'prosemirror-model'
import type { EditorState } from '@remirror/pm/state'
import type { NodeView } from 'prosemirror-view'
import type { EditorView } from '@remirror/pm/view'
import type { EditorSchema } from 'remirror'
import { exitCode } from '@remirror/pm/commands'
import type {
  KeyBinding as CodeMirrorKeyBinding,
} from '@codemirror/view'
import type {
  Transaction as CodeMirrorTransaction,
} from '@codemirror/state'
import { EditorState as CodeMirrorEditorState, Compartment } from '@codemirror/state'
import { EditorView as CodeMirrorEditorView, keymap } from '@codemirror/view'
import { computeChange } from '../CodeMIrror/codemirror-node-view'
import { html } from '@codemirror/lang-html'
import { light } from '@/theme/codemirror'

function removeNewlines(str: string) {
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

  // internal state
  cursorSide: 'start' | 'end'
  private _isEditing: boolean
  private htmlText: string

  constructor(node: ProseNode, view: EditorView, getPos: () => number) {
    // store arguments
    this._node = node
    this._outerView = view
    this._getPos = getPos
    this.schema = node.type.schema

    this.htmlText = node.textContent
    // editing state
    this.cursorSide = 'start'
    this._isEditing = false

    // create dom representation of nodeview
    this.dom = document.createElement('div')
    this.dom.classList.add('html-node')

    this._htmlRenderElt = document.createElement('p')
    this._htmlRenderElt.textContent = ''
    this._htmlRenderElt.classList.add('html-node-render')

    const label = document.createElement('span')
    label.innerHTML = `<i class="ri-expand-left-right-line"></i> HTML`
    label.classList.add('html-node-label')

    this.dom.appendChild(label)

    this.dom.appendChild(this._htmlRenderElt)

    this._htmlSrcElt = document.createElement('div')
    this._htmlSrcElt.classList.add('html-src')

    this.languageConf = new Compartment()

    this.dom.appendChild(this._htmlSrcElt)

    this.dom.addEventListener('click', () => this.ensureFocus())
    label.addEventListener('click', () => this.ensureFocus())
    this.dom.addEventListener('mouseenter', this.handleMouseEnter)
    this.dom.addEventListener('mouseleave', this.handleMouseLeave)

    this.renderHtml()
  }

  destroy() {
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

    this.dom.removeEventListener('mouseenter', this.handleMouseEnter)
    this.dom.removeEventListener('mouseleave', this.handleMouseLeave)
    this.dom.remove()
  }

  private codeMirrorKeymap(): CodeMirrorKeyBinding[] {
    return [
      {
        key: 'Ctrl-Enter',
        run: () => {
          this.closeEditor(true)
          this._outerView.focus()
          if (exitCode(this._outerView.state, this._outerView.dispatch)) {
            this._outerView.focus()
            return true
          }

          return false
        },
      },
    ]
  }

  /**
   * Ensure focus on the inner editor whenever this node has focus.
   * This helps to prevent accidental deletions of html blocks.
   */
  ensureFocus() {
    if (this._innerView && this._outerView.hasFocus()) {
      this._innerView.focus()
    }
  }

  private valueChanged(tr: CodeMirrorTransaction): void {
    if (!this._innerView) return

    this._innerView.update([tr])

    if (!tr.docChanged) {
      return
    }

    const change = computeChange(this.htmlText, tr.state.doc.toString())

    if (change) {
      const start = this._getPos() + 1
      const transaction = this._outerView.state.tr.replaceWith(
        start + change.from,
        start + change.to,
        change.text ? this.schema.text(change.text) : [],
      )
      this._outerView.dispatch(transaction)
    }
  }

  // == Updates ======================================= //

  update(node: ProseNode) {
    if (node.type !== this._node.type) {
      return false
    }
    if (!this._innerView) return false
    this._node = node

    this.htmlText = node.textContent
    const change = computeChange(this._innerView.state.doc.toString(), node.textContent)

    if (change) {
      this._isEditing = true
      this._innerView.dispatch({
        changes: { from: change.from, to: change.to, insert: change.text },
      })
      this._isEditing = false
    }

    return true
  }

  updateCursorPos(state: EditorState): void {
    const pos = this._getPos()
    const size = this._node.nodeSize
    const inPmSelection = state.selection.from < pos + size && pos < state.selection.to

    if (!inPmSelection) {
      this.cursorSide = pos < state.selection.from ? 'end' : 'start'
    }
  }

  // == Events ===================================== //

  selectNode() {
    if (!this._outerView.editable) {
      return
    }
    this.dom.classList.add('ProseMirror-selectednode')
    if (!this._isEditing) {
      this.openEditor()
    }
  }

  deselectNode() {
    this.dom.classList.remove('ProseMirror-selectednode')
    if (this._isEditing) {
      this.closeEditor()
    }
  }

  handleMouseEnter = () => {
    this.dom.classList.add('node-enter')
  }

  handleMouseLeave = () => {
    this.dom.classList.remove('node-enter')
  }

  stopEvent(event: Event): boolean {
    return (
      this._innerView !== undefined &&
      event.target !== undefined &&
      this._innerView.dom.contains(event.target as Node)
    )
  }

  ignoreMutation() {
    return true
  }

  // == Rendering ===================================== //

  renderHtml() {
    if (!this._htmlRenderElt) {
      return
    }

    // get tex string to render
    const content = removeNewlines(this.htmlText)
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

      this._htmlRenderElt.innerHTML = texString
    } catch (err) {}
  }

  // == Inner Editor ================================== /
  setSelection(anchor: number, head: number): void {
    this._innerView?.focus()
    this._isEditing = true
    this._innerView?.dispatch({ selection: { anchor, head } })
    this._isEditing = false
  }

  openEditor() {
    if (this._innerView) {
      throw Error('inner view should not exist!')
    }

    const htmlLang = html()
    const startState = CodeMirrorEditorState.create({
      doc: this.htmlText,
      extensions: [keymap.of(this.codeMirrorKeymap()), this.languageConf.of([]), light, htmlLang],
    })

    this._innerView = new CodeMirrorEditorView({
      state: startState,
      parent: this._htmlSrcElt!,
      dispatch: this.valueChanged.bind(this),
    })

    this._innerView.dispatch({
      effects: this.languageConf.reconfigure(htmlLang.support),
    })

    this._innerView.focus()

    const prevCursorPos: number = 0

    const innerPos = prevCursorPos <= this._getPos() ? 0 : this._node.nodeSize - 2
    this.setSelection(innerPos, innerPos)

    this._htmlRenderElt?.classList.add('node-hide')

    this._isEditing = true
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

    if (render) {
      this.renderHtml()
    }
    this._isEditing = false
  }
}

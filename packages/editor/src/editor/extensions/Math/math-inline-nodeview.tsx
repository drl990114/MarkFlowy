import { history, redo, undo } from '@rme-sdk/pm/history'
import { keymap } from '@rme-sdk/pm/keymap'
import { Node as ProseNode } from '@rme-sdk/pm/model'
import { Command, EditorState, Plugin, TextSelection, Transaction } from '@rme-sdk/pm/state'
import { Decoration, EditorView, NodeView } from '@rme-sdk/pm/view'
import { tex2svgInline } from './mathjax'

function collapseCmd(
  outerView: EditorView,
  dir: 1 | -1,
  requireOnBorder: boolean,
  requireEmptySelection: boolean = true,
): Command {
  return (innerState: EditorState, dispatch) => {
    const outerState = outerView.state
    const { to: outerTo, from: outerFrom } = outerState.selection
    const { to: innerTo, from: innerFrom } = innerState.selection

    if (requireEmptySelection && innerTo !== innerFrom) return false

    const currentPos = dir > 0 ? innerTo : innerFrom
    if (requireOnBorder) {
      const nodeSize = innerState.doc.nodeSize - 2
      if (dir > 0 && currentPos < nodeSize) return false
      if (dir < 0 && currentPos > 0) return false
    }

    if (dispatch) {
      const targetPos = dir > 0 ? outerTo : outerFrom
      outerView.dispatch(
        outerState.tr.setSelection(TextSelection.create(outerState.doc, targetPos)),
      )
      outerView.focus()
    }
    return true
  }
}

export class MathInlineView implements NodeView {
  private _node: ProseNode
  private _outerView: EditorView
  private _getPos: () => number | undefined

  dom: HTMLElement
  private _renderElt: HTMLElement | undefined
  private _srcElt: HTMLElement | undefined
  private _innerView: EditorView | undefined
  private _isEditing: boolean

  constructor(node: ProseNode, view: EditorView, getPos: () => number | undefined) {
    this._node = node
    this._outerView = view
    this._getPos = getPos
    this._isEditing = false

    this.dom = document.createElement('span')
    this.dom.classList.add('inline-input')

    this._renderElt = document.createElement('span')
    this._renderElt.classList.add('inline-input-render')
    this.dom.appendChild(this._renderElt)

    this._srcElt = document.createElement('span')
    this._srcElt.spellcheck = false
    this._srcElt.style.display = 'none'
    this.dom.appendChild(this._srcElt)

    this.dom.addEventListener('click', () => this.ensureFocus())

    if ((node.attrs as any).fromInput) {
      setTimeout(() => this.openEditor())
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
      delete this._srcElt
    }
    this.dom.remove()
  }

  ensureFocus() {
    if (this._innerView && this._outerView.hasFocus()) {
      this._innerView.focus()
    }
  }

  update(node: ProseNode, _decorations: readonly Decoration[]) {
    if (!node.sameMarkup(this._node)) return false
    this._node = node
    if (!this._isEditing) this.renderTex()
    return true
  }

  selectNode() {
    if (!this._outerView.editable) return
    if (!this._isEditing) this.openEditor()
  }

  deselectNode() {
    if (this._isEditing) this.closeEditor()
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

  private renderTex(preview = false) {
    if (!this._renderElt) return
    const raw = this._innerView?.state.doc.textContent ?? (this._node.attrs as any).tex ?? ''
    const tex: string = raw.replace(/\u200b/g, '').trim()

    try {
      while (this._renderElt.firstChild) {
        this._renderElt.firstChild.remove()
      }

      const container = document.createElement('span')
      container.setAttribute('data-type', 'math-inline')
      container.innerHTML = tex2svgInline(tex)

      let newRenderEl: HTMLElement = container
      if (container.childElementCount === 1 && container.firstElementChild) {
        newRenderEl = container.firstElementChild as HTMLElement
      }

      this._renderElt.replaceWith(newRenderEl)
      this._renderElt = newRenderEl

      this.dom.appendChild(this._renderElt)

      if (preview) {
        this._renderElt.classList.add('inline-input-preview')
      } else {
        this._renderElt.classList.add('inline-input-render')
        this._renderElt.classList.remove('inline-input-preview')
      }
    } catch (err) {
      console.error(err)
      this._renderElt.classList.add('parse-error')
      this.dom.setAttribute('title', String(err))
    }
  }

  private dispatchInner(tr: Transaction) {
    if (!this._innerView) return
    const { state } = this._innerView.state.applyTransaction(tr)
    this._innerView.updateState(state)
    this.renderTex(true)
  }

  private openEditor = () => {
    if (this._innerView) return

    const currentTex: string = ((this._node.attrs as any).tex ?? '') as string
    this._innerView = new EditorView(this._srcElt!, {
      state: EditorState.create({
        doc: this._outerView.state.schema.node(
          'paragraph',
          null,
          currentTex
            ? [this._outerView.state.schema.text(currentTex)]
            : [this._outerView.state.schema.text('\u200b')],
        ),
        plugins: [
          history(),
          keymap({
            ArrowLeft: collapseCmd(this._outerView, -1, true),
            ArrowRight: collapseCmd(this._outerView, +1, true),
            ArrowUp: collapseCmd(this._outerView, -1, true),
            ArrowDown: collapseCmd(this._outerView, +1, true),
            'Mod-z': (state, dispatch, view) => undo(state, dispatch, view),
            'Shift-Mod-z': (state, dispatch, view) => redo(state, dispatch, view),
            Backspace: (state) => {
              const { from, to } = state.selection
              if (from === 0 && to === state.doc.content.size) {
                const pos = this._getPos()
                if (pos !== undefined) {
                  const tr = this._outerView.state.tr.delete(pos, pos + this._node.nodeSize)
                  this._outerView.dispatch(tr)
                  this._outerView.focus()
                  return true
                }
              }
              return false
            },
          }),
          new Plugin({
            props: {
              handleDOMEvents: {
                blur: () => {
                  const pos = this._getPos()
                  if (pos !== undefined) {
                    const text = (this._innerView?.state.doc.textContent || '').replace(
                      /\u200b/g,
                      '',
                    )
                    const tr = this._outerView.state.tr
                    tr.setNodeAttribute(pos, 'fromInput', false)
                    tr.setNodeAttribute(pos, 'tex', text)
                    this._outerView.dispatch(tr)
                  }
                  this.closeEditor()
                  return true
                },
              },
            },
          }),
        ],
      }),
      dispatchTransaction: this.dispatchInner.bind(this),
    })

    this._innerView.dom.classList.add('inline-input-src')
    this._innerView.dom.classList.remove('ProseMirror')
    this._srcElt!.style.display = 'inline'

    const innerState = this._innerView.state
    this._innerView.focus()
    const innerPos = innerState.doc.textContent.length || 0
    this._innerView.dispatch(
      innerState.tr.setSelection(TextSelection.create(innerState.doc, innerPos)),
    )

    this._renderElt?.classList.add('inline-input-preview')
    this._isEditing = true
  }

  private closeEditor = (render: boolean = true) => {
    if (this._srcElt) {
      this._srcElt.style.display = 'none'
    }
    if (this._innerView) {
      this._innerView.destroy()
      this._innerView = undefined
    }
    if (render) {
      this.renderTex()
    }
    this._isEditing = false
  }
}

// prosemirror imports
import { history, redo, undo } from '@rme-sdk/sdk/pm/history'
import { keymap } from '@rme-sdk/sdk/pm/keymap'
import type { Node as ProseNode } from '@rme-sdk/sdk/pm/model'
import { EditorState, Plugin, TextSelection } from '@rme-sdk/sdk/pm/state'
import type { Command, Transaction } from '@rme-sdk/sdk/pm/state'
import { EditorView } from '@rme-sdk/sdk/pm/view'
import type { NodeView } from '@rme-sdk/sdk/pm/view'
import type { ExtensionsOptions } from '..'
import { applyImageRequestPolicy } from '../../utils/image-loading'
import {
  clearPreviewImageSource,
  getPreviewImageSource,
  sanitizeMarkdownHtml,
} from '../../utils/sanitize-html'

/**
 * A ProseMirror command for determining whether to exit a math block, based on
 * specific conditions.  Normally called when the user has
 *
 * @param outerView The main ProseMirror EditorView containing this math node.
 * @param dir Used to indicate desired cursor position upon closing a math node.
 *     When set to -1, cursor will be placed BEFORE the math node.
 *     When set to +1, cursor will be placed AFTER the math node.
 * @param borderMode An exit condition based on cursor position and direction.
 * @param requireEmptySelection When TRUE, only exit the math node when the
 *    (inner) selection is empty.
 * @returns A new ProseMirror command based on the input configuration.
 */
export function collapseCmd(
  outerView: EditorView,
  dir: 1 | -1,
  requireOnBorder: boolean,
  requireEmptySelection: boolean = true,
  onSave?: (text: string) => void,
): Command {
  return (innerState: EditorState, dispatch: ((tr: Transaction) => void) | undefined) => {
    const { to: innerTo, from: innerFrom } = innerState.selection

    if (requireEmptySelection && innerTo !== innerFrom) {
      return false
    }
    const currentPos: number = dir > 0 ? innerTo : innerFrom

    if (requireOnBorder) {
      const nodeSize = innerState.doc.nodeSize - 2

      if (dir > 0 && currentPos < nodeSize) {
        return false
      }
      if (dir < 0 && currentPos > 0) {
        return false
      }
    }

    if (dispatch) {
      if (onSave) {
        onSave(innerState.doc.textContent)
      }

      const updatedOuterState = outerView.state
      const { to: updatedOuterTo, from: updatedOuterFrom } = updatedOuterState.selection
      const targetPos: number = dir > 0 ? updatedOuterTo : updatedOuterFrom

      outerView.dispatch(
        updatedOuterState.tr.setSelection(TextSelection.create(updatedOuterState.doc, targetPos)),
      )

      outerView.focus()
    }

    return true
  }
}

interface IHtmlInlineViewOptions {
  handleViewImgSrcUrl?: ExtensionsOptions['handleViewImgSrcUrl']
}

export class HTMLInlineView implements NodeView {
  // nodeview params
  private _node: ProseNode
  private _outerView: EditorView
  private _getPos: () => number | undefined

  // nodeview dom
  dom: HTMLElement
  private _htmlRenderElt: HTMLElement | undefined
  private _htmlSrcElt: HTMLElement | undefined
  private _innerView: EditorView | undefined

  private _tagName: string
  private _isEditing: boolean

  options: IHtmlInlineViewOptions

  constructor(
    node: ProseNode,
    view: EditorView,
    getPos: () => number | undefined,
    options: IHtmlInlineViewOptions = {},
  ) {
    // store arguments
    this._node = node
    this._outerView = view
    this._getPos = getPos
    this.options = options

    // editing state
    this._isEditing = false

    // options
    this._tagName = 'span'

    // create dom representation of nodeview
    this.dom = document.createElement(this._tagName)
    this.dom.classList.add('inline-input')

    this._htmlRenderElt = document.createElement('span')
    this._htmlRenderElt.textContent = ''
    this._htmlRenderElt.classList.add('inline-input-render')
    this.dom.appendChild(this._htmlRenderElt)

    this._htmlSrcElt = document.createElement('span')
    this._htmlSrcElt.classList.add('inline-input-source-shell')
    this._htmlSrcElt.spellcheck = false
    this._htmlSrcElt.style.display = 'none'
    this.dom.appendChild(this._htmlSrcElt)

    // ensure
    this.dom.addEventListener('click', () => this.ensureFocus())

    // render initial content

    if (node.attrs.fromInput) {
      setTimeout(() => {
        this.openEditor()
      })
    } else {
      this.renderHtml()
    }
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
      delete this._htmlSrcElt
    }

    this.dom.remove()
  }

  ensureFocus() {
    if (this._innerView && this._outerView.hasFocus()) {
      this._innerView.focus()
    }
  }

  // == Updates ======================================= //

  update(node: ProseNode) {
    if (!node.sameMarkup(this._node)) return false
    this._node = node
    console.log('update', node)

    if (!this._isEditing) {
      this.renderHtml()
    }

    return true
  }

  // == Events ===================================== //

  selectNode() {
    if (!this._outerView.editable) {
      return
    }

    if (!this._isEditing) {
      this.openEditor()
    }
  }

  deselectNode() {
    if (this._isEditing) {
      this.closeEditor()
    }
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

  renderHtml(preview = false) {
    if (!this._htmlRenderElt) {
      return
    }

    const content = this._innerView?.state.doc.textContent || this._node.attrs?.htmlText || ''
    const html = sanitizeMarkdownHtml(content.trim(), {
      preserveImageSources: Boolean(this.options.handleViewImgSrcUrl),
    })

    try {
      while (this._htmlRenderElt.firstChild) {
        this._htmlRenderElt.firstChild.remove()
      }

      const domParser = new DOMParser()
      const doc = domParser.parseFromString(html, 'text/html')
      const childNodes: Node[] = []
      doc.body.querySelectorAll('img').forEach((image) => {
        applyImageRequestPolicy(image)
        const source = getPreviewImageSource(image)
        if (source && this.options.handleViewImgSrcUrl) {
          const targetUrl = source.includes(location.origin)
            ? source.split(location.origin)[1]
            : source

          void this.options
            .handleViewImgSrcUrl(targetUrl)
            .then((newHref) => {
              image.setAttribute('src', newHref)
              clearPreviewImageSource(image)
            })
            .catch(() => {
              image.removeAttribute('src')
              clearPreviewImageSource(image)
            })
        }
      })
      doc.body.childNodes.forEach((child) => {
        childNodes.push(child)
      })

      childNodes.forEach((child) => {
        this._htmlRenderElt!.appendChild(child)
      })

      if (preview) {
        this._htmlRenderElt.classList.add('inline-input-preview')
      }
    } catch (err) {
      console.error(err)
      this._htmlRenderElt?.classList.add('parse-error')
      this.dom.setAttribute('title', err instanceof Error ? err.message : String(err))
    }
  }

  // == Inner Editor ================================== //

  dispatchInner(tr: Transaction) {
    if (!this._innerView) {
      return
    }

    const { state } = this._innerView.state.applyTransaction(tr)
    this._innerView.updateState(state)

    this.renderHtml(true)
  }

  openEditor() {
    if (this._innerView) {
      console.warn('[HTMLInlineView] editor already open when openEditor was called')
      return
    }

    const saveContent = (text: string) => {
      const pos = this._getPos()
      if (pos !== undefined) {
        const tr = this._outerView.state.tr
        tr.setNodeAttribute(pos, 'fromInput', false)
        tr.setNodeAttribute(pos, 'htmlText', text)
        this._outerView.dispatch(tr)
      }
    }

    this._innerView = new EditorView(this._htmlSrcElt!, {
      state: EditorState.create({
        doc: this._outerView.state.schema.node('paragraph', null, [
          this._outerView.state.schema.text(this._node.attrs?.htmlText),
        ]),
        plugins: [
          history(),
          keymap({
            Tab: (state, dispatch) => {
              if (dispatch) {
                dispatch(state.tr.insertText('\t'))
              }
              return true
            },
            ArrowLeft: collapseCmd(this._outerView, -1, true, true, saveContent),
            ArrowRight: collapseCmd(this._outerView, +1, true, true, saveContent),
            ArrowUp: collapseCmd(this._outerView, -1, true, true, saveContent),
            ArrowDown: collapseCmd(this._outerView, +1, true, true, saveContent),
            'Mod-z': (state, dispatch, view) => {
              return undo(state, dispatch, view)
            },
            'Shift-Mod-z': (state, dispatch, view) => {
              return redo(state, dispatch, view)
            },
          }),

          new Plugin({
            props: {
              handleDOMEvents: {
                blur: () => {
                  const pos = this._getPos()
                  if (pos !== undefined) {
                    const text = this._innerView?.state.doc.textContent || ''
                    const tr = this._outerView.state.tr
                    tr.setNodeAttribute(pos, 'fromInput', false)
                    tr.setNodeAttribute(pos, 'htmlText', text)
                    this._outerView.dispatch(tr)
                  }
                  this.closeEditor()
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
    this._htmlSrcElt!.style.display = 'inline'

    // focus element
    const innerState = this._innerView.state
    this._innerView.focus()

    const innerPos = innerState.doc.textContent.length || 0

    this._innerView.dispatch(
      innerState.tr.setSelection(TextSelection.create(innerState.doc, innerPos)),
    )

    this._htmlRenderElt?.classList.add('inline-input-preview')

    this._isEditing = true
  }

  /**
   * Called when the inner ProseMirror editor should close.
   *
   * @param render Optionally update the rendered html after closing. (which
   *    is generally what we want to do, since the user is done editing!)
   */
  closeEditor(render: boolean = true) {
    if (this._htmlSrcElt) {
      this._htmlSrcElt.style.display = 'none'
    }
    if (this._innerView) {
      this._innerView.destroy()
      this._innerView = undefined
    }

    if (render) {
      this.renderHtml()
      this._htmlRenderElt?.classList.add('inline-input-render')
      this._htmlRenderElt?.classList.remove('inline-input-preview')
    }

    this._isEditing = false
  }
}

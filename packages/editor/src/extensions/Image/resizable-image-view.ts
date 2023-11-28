import { ResizableNodeView, ResizableRatioType } from 'prosemirror-resizable-view'
import { setStyle } from '@remirror/core'
import type { EditorView, NodeView, ProsemirrorNode } from '@remirror/pm'

/**
 * ResizableImageView is a NodeView for image. You can resize the image by
 * dragging the handle over the image.
 */
export class ResizableImageView extends ResizableNodeView implements NodeView {
  _getPos: () => number
  private _node: ProsemirrorNode
  private readonly _view: EditorView

  private src_val = ''
  
  _input_view: HTMLElement | undefined

  constructor(node: ProsemirrorNode, view: EditorView, getPos: () => number) {
    super({ node, view, getPos, aspectRatio: ResizableRatioType.Fixed })
    this._view = view
    this._node = node
    this._getPos = getPos
  }

  openInput() {
    const container = document.createElement('div')
    const input = document.createElement('input')
    const view = this._view

    const setAttrs = (value: string) => {
      const pos = this._getPos()
      if (pos) {
        view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { src: value }))
      }
    }

    input.addEventListener('input', (e) => {
      if (e.target) {
        this.src_val = (e.target as HTMLInputElement).value
      }
    })

    input.value = this._node.attrs.src || ''

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        setAttrs(this.src_val)
        this.closeInput()
      }
    })

    container.classList.add('img-input__container')
    container.append(input)

    const rect = this.dom.getBoundingClientRect()

    container.style.position = 'fixed'
    container.style.top = `${rect.top - 26}px`
    container.style.left = `${rect.left}px`

    document.body.appendChild(container)
    this._input_view = container
    this.dom.classList.add('ProseMirror-selectednode')
    input.focus()
  }

  closeInput() {
    this.dom.classList.remove('ProseMirror-selectednode')
    if (this._input_view) {
      this._input_view.remove()
      this._input_view = undefined
    }
  }

  selectNode = () => {
    if (!this._input_view) {
      this.openInput()
    }
  }

  deselectNode = () => {
    this.closeInput()
  }

  createElement({ node }: { node: ProsemirrorNode }): HTMLImageElement {
    const inner = document.createElement('img')

    inner.setAttribute('src', node.attrs.src || '')

    setStyle(inner, {
      width: '100%',
      minWidth: '50px',
      objectFit: 'contain', // maintain image's aspect ratio
    })

    return inner
  }

  destroy(): void {
    super.destroy()
    this.closeInput()
  }
}

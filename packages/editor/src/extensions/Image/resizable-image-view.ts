import { ResizableNodeView, ResizableRatioType } from 'prosemirror-resizable-view'
import { setStyle } from '@remirror/core'
import type { EditorView, NodeView, ProsemirrorNode } from '@remirror/pm'

/**
 * ResizableImageView is a NodeView for image. You can resize the image by
 * dragging the handle over the image.
 */
export class ResizableImageView extends ResizableNodeView implements NodeView {
  
  _getPos: () => number
  _view: any
  _node: any

  constructor(node: ProsemirrorNode, view: EditorView, getPos: () => number) {
    super({ node, view, getPos, aspectRatio: ResizableRatioType.Fixed })
    this._view = view
    this._node = node
    this._getPos = getPos
  }

  showInput() {
    const input = document.createElement("input")
    // TODO
    console.log('this', this.dom)
    document.body.appendChild(input)
    this.dom.classList.add('ProseMirror-selectednode')
    input.focus()
  }
  
  selectNode?: (() => void) | undefined = () => {
    this.showInput()
  }

  createElement({ node }: { node: ProsemirrorNode }): HTMLImageElement {
    const inner = document.createElement('img')

    inner.setAttribute('src', node.attrs.src || 'https://remirror.io/img/logo.svg')

    setStyle(inner, {
      width: '100%',
      minWidth: '50px',
      objectFit: 'contain', // maintain image's aspect ratio
    })

    return inner
  }
}

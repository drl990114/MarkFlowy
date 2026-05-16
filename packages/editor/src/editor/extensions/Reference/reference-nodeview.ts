// prosemirror imports
import { Node as ProseNode } from '@rme-sdk/pm/model'
import { TextSelection } from '@rme-sdk/pm/state'
import { EditorView, NodeView } from '@rme-sdk/pm/view'
import { isBrowser } from '../../utils/common'

export class ReferenceNodeView implements NodeView {
  // nodeview params
  private _node: ProseNode
  private _outerView: EditorView
  private _getPos: () => number | undefined

  // nodeview dom
  dom: HTMLElement

  private _removing = false

  // Elements for each editable part
  private _labelElement: HTMLElement
  private _separatorElement: HTMLElement
  private _hrefElement: HTMLElement
  private _titleElement: HTMLElement

  constructor(node: ProseNode, view: EditorView, getPos: () => number | undefined) {
    // store arguments
    this._node = node
    this._outerView = view
    this._getPos = getPos

    // create dom representation of nodeview
    this.dom = document.createElement('div')
    this.dom.classList.add('reference-definition-node')

    // Create elements for each part
    this._labelElement = document.createElement('span')
    this._labelElement.classList.add('reference-definition-node__label')
    // this._labelElement.contentEditable = 'true'

    this._separatorElement = document.createElement('span')
    this._separatorElement.classList.add('reference-definition-node__separator')
    this._separatorElement.textContent = ':'

    this._hrefElement = document.createElement('span')
    this._hrefElement.classList.add('reference-definition-node__href')
    // this._hrefElement.contentEditable = 'true'

    this._titleElement = document.createElement('span')
    this._titleElement.classList.add('reference-definition-node__title')
    // this._titleElement.contentEditable = 'true'

    // Append elements to dom
    this.dom.appendChild(this._labelElement)
    this.dom.appendChild(this._separatorElement)
    this.dom.appendChild(this._hrefElement)
    this.dom.appendChild(this._titleElement)

    // Add event listeners for updates
    this._labelElement.addEventListener('blur', () => this.onLabelChange())
    this._hrefElement.addEventListener('blur', () => this.onHrefChange())
    this._titleElement.addEventListener('blur', () => this.onTitleChange())

    // Prevent enter key from creating newlines
    this._labelElement.addEventListener('keydown', (e) => this.handleKeyDown(e))
    this._hrefElement.addEventListener('keydown', (e) => this.handleKeyDown(e))
    this._titleElement.addEventListener('keydown', (e) => this.handleKeyDown(e))

    // Render initial content
    this.renderContent()
  }

  destroy() {
    // Clean up dom elements
    this.dom.remove()
  }

  // == Updates ======================================= //

  update(node: ProseNode) {
    if (!node.sameMarkup(this._node)) return false
    this._node = node
    this.renderContent()
    return true
  }

  // == Events ===================================== //

  selectNode() {
    if (!this._outerView.editable) {
      return
    }

    // Focus the first editable field by default
    this._labelElement.focus()
  }

  deselectNode() {
    // Blur all elements when node is deselected
    this._labelElement.blur()
    this._hrefElement.blur()
    this._titleElement.blur()
  }

  stopEvent(event: Event): boolean {
    const target = event.target as Node
    return (
      this._labelElement.contains(target) ||
      this._hrefElement.contains(target) ||
      this._titleElement.contains(target)
    )
  }

  ignoreMutation() {
    return true
  }

  // == Rendering ===================================== //

  renderContent() {
    const attrs = this._node.attrs
    const labelText = attrs.label ? `${attrs.label}` : ''
    const hrefText = attrs.href ? `${attrs.href}` : ''
    const titleText = attrs.title ? `${attrs.title}` : ''

    // Update text content
    this._labelElement.textContent = labelText
    this._hrefElement.textContent = hrefText
    this._titleElement.textContent = titleText
  }

  // == Event Handlers ================================== //

  handleKeyDown = (event: KeyboardEvent) => {
    // Prevent enter key from creating newlines
    if (event.key === 'Enter') {
      event.preventDefault()
      ;(event.target as HTMLElement).blur()
      return
    }

    // Handle delete key when label element is empty
    if (event.key === 'Backspace' && event.target === this._labelElement) {
      if (!isBrowser()) return
      const selection = window.getSelection()
      if (
        selection &&
        selection.rangeCount > 0 &&
        this._labelElement.textContent === '' &&
        selection.anchorOffset === 0 &&
        selection.focusOffset === 0
      ) {
        // Prevent default behavior
        event.preventDefault()

        const pos = this._getPos()
        if (pos !== undefined) {
          this._removing = true

          const hrefText = this._hrefElement.textContent || ''

          if (hrefText.trim() !== '') {
            const textNode = this._outerView.state.schema.text(hrefText)
            const tr = this._outerView.state.tr
            const tr2 = tr.replaceWith(pos, pos + this._node.nodeSize, textNode)
            tr2.setSelection(TextSelection.near(tr2.doc.resolve(pos)))

            this._outerView.dispatch(tr2)
            this._outerView.focus()
          } else {
            // 如果href中没有文本，直接删除当前节点
            const deleteTr = this._outerView.state.tr
            deleteTr.delete(pos, pos + this._node.nodeSize)
            // Set selection to the position where the node was deleted
            deleteTr.setSelection(TextSelection.near(deleteTr.doc.resolve(pos)))
            this._outerView.dispatch(deleteTr)
            this._outerView.focus()
          }
        }
      }
    }
  }

  onLabelChange = () => {
    if (this._removing) {
      return
    }
    const newText = this._labelElement.textContent || ''
    const pos = this._getPos()

    if (pos !== undefined) {
      const tr = this._outerView.state.tr
      tr.setNodeAttribute(pos, 'label', newText)
      this._outerView.dispatch(tr)
    }
  }

  onHrefChange = () => {
    if (this._removing) {
      return
    }
    const newText = this._hrefElement.textContent || ''
    const pos = this._getPos()

    if (pos !== undefined) {
      const tr = this._outerView.state.tr
      tr.setNodeAttribute(pos, 'href', newText)
      this._outerView.dispatch(tr)
    }
  }

  onTitleChange = () => {
    if (this._removing) {
      return
    }
    const newText = this._titleElement.textContent || ''
    const pos = this._getPos()

    if (pos !== undefined) {
      const tr = this._outerView.state.tr
      tr.setNodeAttribute(pos, 'title', newText)
      this._outerView.dispatch(tr)
    }
  }
}

import { EditorView as CodeMirrorEditorView } from '@codemirror/view'
import type { NodeView, ProsemirrorNode } from '@rme-sdk/pm'
import { NodeSelection } from '@rme-sdk/pm/state'
import type { EditorView } from '@rme-sdk/pm/view'
import { MfCodemirrorView } from '../../codemirror'
import { isBrowser } from '../../utils/common'
import type {
  LivePreviewMode,
  LivePreviewNodeViewApi,
  LivePreviewNodeViewOptions,
  LivePreviewRenderer,
} from './live-preview-types'

const renderDelay = 120

export class LivePreviewNodeView implements NodeView, LivePreviewNodeViewApi {
  dom: HTMLElement

  private node: ProsemirrorNode
  private readonly view: EditorView
  private readonly getPos: () => number
  private readonly renderer: LivePreviewRenderer
  private readonly editorElt: HTMLElement
  private readonly previewElt: HTMLElement
  private readonly bodyElt: HTMLElement
  private readonly toggleButton: HTMLButtonElement
  private readonly fullscreenButton: HTMLButtonElement
  private readonly copyButton: HTMLButtonElement
  private cmView?: CodeMirrorEditorView
  private mfCodemirrorView?: MfCodemirrorView
  private mode: LivePreviewMode
  private modeBeforePreviewZoom: LivePreviewMode | undefined
  private fullscreen = false
  private lastCodeMirrorSelectionHead: number | undefined
  private renderTimer: ReturnType<typeof setTimeout> | undefined
  private renderVersion = 0
  private destroying = false
  private readonly customCopyFunction?: LivePreviewNodeViewOptions['customCopyFunction']

  constructor(options: LivePreviewNodeViewOptions) {
    this.node = options.node
    this.view = options.view
    this.getPos = options.getPos
    this.renderer = options.renderer
    this.mode = options.defaultMode ?? 'split'
    this.customCopyFunction = options.customCopyFunction

    this.dom = document.createElement('div')
    this.dom.classList.add('mf-live-preview-block', this.renderer.className)
    this.dom.dataset.mode = this.mode

    const header = document.createElement('div')
    header.className = 'mf-live-preview-header'

    const language = document.createElement('div')
    language.className = 'mf-live-preview-language'
    language.textContent = this.renderer.displayName

    const toolbar = document.createElement('div')
    toolbar.className = 'mf-live-preview-toolbar'

    this.copyButton = this.createToolbarButton('ri-file-copy-line', 'Copy source')
    this.toggleButton = this.createToolbarButton('ri-layout-right-line', 'Preview only')
    this.fullscreenButton = this.createToolbarButton('ri-fullscreen-line', 'Fullscreen')

    toolbar.append(this.copyButton, this.toggleButton, this.fullscreenButton)
    header.append(language, toolbar)

    this.bodyElt = document.createElement('div')
    this.bodyElt.className = 'mf-live-preview-body'

    this.editorElt = document.createElement('div')
    this.editorElt.className = 'mf-live-preview-editor'

    const divider = document.createElement('button')
    divider.className = 'mf-live-preview-divider'
    divider.type = 'button'
    divider.title = 'Toggle preview'
    divider.innerHTML = '<i class="ri-arrow-left-s-line"></i>'

    this.previewElt = document.createElement('div')
    this.previewElt.className = 'mf-live-preview-render'

    this.bodyElt.append(this.editorElt, divider, this.previewElt)
    this.dom.append(header, this.bodyElt)

    this.copyButton.addEventListener('click', this.copySource)
    this.toggleButton.addEventListener('click', this.toggleMode)
    divider.addEventListener('click', this.toggleMode)
    this.fullscreenButton.addEventListener('click', this.toggleFullscreen)
    toolbar.addEventListener('mousedown', this.stopToolbarMouseDown)
    header.addEventListener('mousedown', this.selectWholeNode)
    this.previewElt.addEventListener('click', this.zoomPreview)
    this.dom.addEventListener('mousedown', this.ensureFocus)

    this.createCodeMirror()
    this.applyMode()
    this.render()
    this.renderer.onMount?.(this)

    if (options.openOnMount) {
      this.focus()
    }
  }

  update(node: ProsemirrorNode): boolean {
    if (node.type !== this.node.type) {
      return false
    }
    this.node = node
    const updated = this.mfCodemirrorView?.update(node) ?? true
    this.scheduleRender(node.textContent)
    return updated
  }

  setSelection(anchor: number, head: number): void {
    this.mfCodemirrorView?.setSelection(anchor, head)
  }

  focus(): void {
    this.cmView?.focus()
    this.mfCodemirrorView?.forwardSelection()
  }

  stopEvent(): boolean {
    return true
  }

  ignoreMutation(): boolean {
    return true
  }

  selectNode(): void {
    this.dom.classList.add('mf-live-preview-selected')
  }

  deselectNode(): void {
    this.dom.classList.remove('mf-live-preview-selected')
  }

  destroy(): void {
    this.destroying = true
    if (this.renderTimer) {
      clearTimeout(this.renderTimer)
    }
    this.setFullscreen(false)
    this.renderer.onDestroy?.(this)
    this.mfCodemirrorView?.destroy()
    this.mfCodemirrorView = undefined
    this.cmView = undefined
    this.dom.remove()
  }

  render = (): void => {
    this.scheduleRender(this.getContent(), 0)
  }

  private createCodeMirror(): void {
    this.mfCodemirrorView = new MfCodemirrorView({
      view: this.view,
      node: this.node,
      getPos: this.getPos,
      languageName: this.renderer.languageName,
      extensions: this.renderer.getCodeMirrorExtensions(),
      options: {
        useProsemirrorHistoryKey: true,
        codemirrorEditorViewConfig: {
          parent: this.editorElt,
        },
        copyButton: {
          enabled: false,
        },
        onValueChange: (value) => {
          this.recordCodeMirrorSelection()
          this.scheduleRender(value)
        },
      },
    })
    this.cmView = this.mfCodemirrorView.cm
  }

  private scheduleRender(content: string, delay = renderDelay): void {
    if (this.destroying) return
    if (this.renderTimer) {
      clearTimeout(this.renderTimer)
    }
    const version = ++this.renderVersion
    this.renderTimer = setTimeout(() => {
      if (this.destroying || version !== this.renderVersion) return
      void this.renderContent(content, version)
    }, delay)
  }

  private async renderContent(content: string, version: number): Promise<void> {
    this.previewElt.classList.remove('mf-live-preview-render-error')
    this.previewElt.removeAttribute('title')
    try {
      await this.renderer.render(content, this.previewElt, {
        node: this.node,
        view: this.view,
      })
      if (this.destroying || version !== this.renderVersion) return
    } catch (err) {
      if (this.destroying || version !== this.renderVersion) return
      this.previewElt.replaceChildren()
      const error = document.createElement('pre')
      error.className = 'mf-live-preview-error'
      error.textContent = err instanceof Error ? err.message : String(err)
      this.previewElt.appendChild(error)
      this.previewElt.classList.add('mf-live-preview-render-error')
      this.previewElt.setAttribute('title', error.textContent)
    }
  }

  private getContent(): string {
    return this.mfCodemirrorView?.content ?? this.node.textContent
  }

  private ensureFocus = (event: MouseEvent): void => {
    if (
      event.target instanceof HTMLElement &&
      event.target.closest(
        '.mf-live-preview-header, .mf-live-preview-divider, .mf-live-preview-render',
      )
    ) {
      return
    }
    if (this.view.hasFocus()) {
      this.focus()
    }
  }

  private toggleMode = (event: MouseEvent): void => {
    event.preventDefault()
    event.stopPropagation()
    this.mode = this.mode === 'split' ? 'preview' : 'split'
    this.applyMode()
  }

  private applyMode(): void {
    this.dom.dataset.mode = this.mode
    const previewOnly = this.mode === 'preview'
    this.toggleButton.title = previewOnly ? 'Show editor' : 'Preview only'
    this.toggleButton.innerHTML = previewOnly
      ? '<i class="ri-layout-left-line"></i>'
      : '<i class="ri-layout-right-line"></i>'
  }

  private toggleFullscreen = (event: MouseEvent): void => {
    event.preventDefault()
    event.stopPropagation()
    this.modeBeforePreviewZoom = undefined
    this.setFullscreen(!this.fullscreen)
  }

  private setFullscreen(fullscreen: boolean): void {
    if (this.fullscreen === fullscreen) {
      return
    }
    this.fullscreen = fullscreen
    this.dom.classList.toggle('mf-live-preview-fullscreen', this.fullscreen)
    this.fullscreenButton.title = this.fullscreen ? 'Exit fullscreen' : 'Fullscreen'
    this.fullscreenButton.innerHTML = this.fullscreen
      ? '<i class="ri-fullscreen-exit-line"></i>'
      : '<i class="ri-fullscreen-line"></i>'
    const method = this.fullscreen ? 'addEventListener' : 'removeEventListener'
    document[method]('keydown', this.handleDocumentKeydown as EventListener, true)

    // Dispatch custom event so the host app can adjust UI (e.g., lower sidebar/statusbar z-index)
    document.dispatchEvent(
      new CustomEvent('mf:livepreview-fullscreen', { detail: { fullscreen: this.fullscreen } }),
    )

    if (this.fullscreen && this.mode !== 'preview') {
      this.focusCodeMirrorAtStoredPosition()
    }

    if (!this.fullscreen && this.modeBeforePreviewZoom) {
      this.mode = this.modeBeforePreviewZoom
      this.modeBeforePreviewZoom = undefined
      this.applyMode()
    }
  }

  private handleDocumentKeydown = (event: KeyboardEvent): void => {
    if (!this.fullscreen || event.key !== 'Escape') {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    this.setFullscreen(false)
  }

  private selectWholeNode = (event: MouseEvent): void => {
    if (
      event.target instanceof HTMLElement &&
      event.target.closest('.mf-live-preview-toolbar')
    ) {
      return
    }
    event.preventDefault()
    this.recordCodeMirrorSelection()
    const pos = this.getPos()
    const tr = this.view.state.tr.setSelection(NodeSelection.create(this.view.state.doc, pos))
    this.view.dispatch(tr.scrollIntoView())
    this.view.focus()
  }

  private zoomPreview = (event: MouseEvent): void => {
    if (this.fullscreen) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    this.modeBeforePreviewZoom = this.mode
    this.mode = 'preview'
    this.applyMode()
    this.setFullscreen(true)
  }

  private stopToolbarMouseDown = (event: MouseEvent): void => {
    event.stopPropagation()
  }

  private recordCodeMirrorSelection(): void {
    if (!this.cmView) {
      return
    }
    if (!this.cmView.hasFocus) {
      this.lastCodeMirrorSelectionHead = undefined
      return
    }
    this.lastCodeMirrorSelectionHead = this.cmView.state.selection.main.head
  }

  private focusCodeMirrorAtStoredPosition(): void {
    if (!this.cmView || !isBrowser()) {
      return
    }
    requestAnimationFrame(() => {
      if (!this.cmView || !this.fullscreen || this.mode === 'preview') {
        return
      }

      const docLength = this.cmView.state.doc.length
      const currentSelection = this.cmView.state.selection.main
      const storedHead = this.lastCodeMirrorSelectionHead
      const hasStoredHead =
        typeof storedHead === 'number' &&
        storedHead >= 0 &&
        storedHead <= docLength
      const cursor = hasStoredHead
        ? storedHead
        : currentSelection.empty
          ? currentSelection.head
          : docLength

      this.cmView.focus()
      this.cmView.dispatch({
        selection: { anchor: cursor },
        effects: CodeMirrorEditorView.scrollIntoView(cursor, { y: 'center' }),
      })
      this.mfCodemirrorView?.forwardSelection()
    })
  }

  private copySource = async (event: MouseEvent): Promise<void> => {
    event.preventDefault()
    event.stopPropagation()
    const code = this.getContent()

    if (this.customCopyFunction) {
      const copied = await this.customCopyFunction(code)
      if (copied) {
        this.showCopySuccess()
      }
      return
    }

    if (isBrowser() && navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(code)
      this.showCopySuccess()
    }
  }

  private showCopySuccess(): void {
    const original = this.copyButton.innerHTML
    const originalTitle = this.copyButton.title
    this.copyButton.innerHTML = '<i class="ri-check-line"></i>'
    this.copyButton.title = 'Copied'
    setTimeout(() => {
      this.copyButton.innerHTML = original
      this.copyButton.title = originalTitle
    }, 1200)
  }

  private createToolbarButton(icon: string, title: string): HTMLButtonElement {
    const button = document.createElement('button')
    button.className = 'mf-live-preview-tool'
    button.type = 'button'
    button.title = title
    button.innerHTML = `<i class="${icon}"></i>`
    return button
  }
}

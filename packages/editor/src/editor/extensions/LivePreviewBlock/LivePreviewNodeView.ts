import { EditorView as CodeMirrorEditorView } from '@codemirror/view'
import type { NodeView, ProsemirrorNode } from '@rme-sdk/sdk/pm'
import { NodeSelection } from '@rme-sdk/sdk/pm/state'
import type { EditorView } from '@rme-sdk/sdk/pm/view'
import { MfCodemirrorView } from '../../codemirror'
import { shouldStopNodeViewEvent } from '../../codemirror/stop-event'
import { isBrowser } from '../../utils/common'
import {
  registerLivePreviewBehaviorTarget,
  unregisterLivePreviewBehaviorTarget,
  type LivePreviewBehaviorTarget,
} from './live-preview-registry'
import type {
  LivePreviewBlockBehavior,
  LivePreviewMode,
  LivePreviewNodeViewApi,
  LivePreviewNodeViewOptions,
  LivePreviewRenderer,
} from './live-preview-types'

const renderDelay = 120
let editorId = 0

export class LivePreviewNodeView
  implements NodeView, LivePreviewNodeViewApi, LivePreviewBehaviorTarget {
  dom: HTMLElement

  private node: ProsemirrorNode
  private readonly view: EditorView
  private readonly getPos: () => number
  private readonly renderer: LivePreviewRenderer
  private readonly editorElt: HTMLElement
  private readonly previewElt: HTMLElement
  private readonly bodyElt: HTMLElement
  private readonly toggleButton: HTMLButtonElement
  private readonly collapseButton: HTMLButtonElement
  private readonly fullscreenButton: HTMLButtonElement
  private readonly copyButton: HTMLButtonElement
  private cmView?: CodeMirrorEditorView
  private mfCodemirrorView?: MfCodemirrorView
  private behavior: LivePreviewBlockBehavior
  private focusOpen: boolean
  private manuallyCollapsed = false
  private searchOpen = false
  private mode: LivePreviewMode
  private fullscreen = false
  private lastCodeMirrorSelectionHead: number | undefined
  private renderTimer: ReturnType<typeof setTimeout> | undefined
  private focusFrame: number | undefined
  private collapseFrame: number | undefined
  private waitingForWindowFocus = false
  private renderVersion = 0
  private destroying = false
  private readonly customCopyFunction?: LivePreviewNodeViewOptions['customCopyFunction']

  constructor(options: LivePreviewNodeViewOptions) {
    this.node = options.node
    this.view = options.view
    this.getPos = options.getPos
    this.renderer = options.renderer
    this.behavior = registerLivePreviewBehaviorTarget(
      this.view,
      this,
      options.behavior ?? 'auto',
    )
    this.focusOpen =
      options.defaultMode !== undefined
        ? options.defaultMode === 'split'
        : Boolean(options.openOnMount || this.node.textContent.length === 0)
    this.mode = this.resolveMode()
    this.customCopyFunction = options.customCopyFunction

    this.dom = document.createElement('div')
    this.dom.classList.add('mf-live-preview-block', this.renderer.className)
    this.dom.dataset.mode = this.mode
    this.dom.dataset.behavior = this.behavior

    const header = document.createElement('div')
    header.className = 'mf-live-preview-header'

    const language = document.createElement('div')
    language.className = 'mf-live-preview-language'
    language.textContent = this.renderer.displayName

    const toolbar = document.createElement('div')
    toolbar.className = 'mf-live-preview-toolbar'

    this.copyButton = this.createToolbarButton('ri-file-copy-line', 'Copy source')
    this.toggleButton = this.createToolbarButton('ri-code-s-slash-line', 'Edit source')
    this.fullscreenButton = this.createToolbarButton('ri-fullscreen-line', 'Fullscreen')

    toolbar.append(this.toggleButton, this.copyButton, this.fullscreenButton)
    header.append(language, toolbar)

    this.bodyElt = document.createElement('div')
    this.bodyElt.className = 'mf-live-preview-body'

    this.editorElt = document.createElement('div')
    this.editorElt.className = 'mf-live-preview-editor'
    this.editorElt.id = `mf-live-preview-editor-${++editorId}`

    const divider = document.createElement('div')
    divider.className = 'mf-live-preview-divider'

    this.collapseButton = this.createToolbarButton('ri-arrow-left-s-line', 'Hide source')
    this.collapseButton.classList.add('mf-live-preview-collapse')
    this.collapseButton.setAttribute('aria-controls', this.editorElt.id)
    divider.append(this.collapseButton)

    this.previewElt = document.createElement('div')
    this.previewElt.className = 'mf-live-preview-render'

    this.bodyElt.append(this.editorElt, divider, this.previewElt)
    this.dom.append(header, this.bodyElt)

    this.copyButton.addEventListener('click', this.copySource)
    this.toggleButton.addEventListener('click', this.toggleMode)
    this.collapseButton.addEventListener('click', this.collapseSource)
    this.fullscreenButton.addEventListener('click', this.toggleFullscreen)
    toolbar.addEventListener('mousedown', this.stopToolbarMouseDown)
    header.addEventListener('mousedown', this.selectWholeNode)
    this.dom.addEventListener('mousedown', this.ensureFocus)
    this.dom.addEventListener('focusin', this.handleFocusIn)
    this.dom.addEventListener('focusout', this.handleFocusOut)
    this.dom.addEventListener('keydown', this.handleKeydown)

    this.createCodeMirror()
    this.applyMode()
    this.render()
    this.renderer.onMount?.(this)

    if (options.openOnMount) {
      this.editSource()
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
    this.manuallyCollapsed = false
    this.focusOpen = true
    this.applyMode()
    this.cmView?.requestMeasure()
    this.mfCodemirrorView?.setSelection(anchor, head)
  }

  focus(): void {
    this.editSource()
  }

  getPosition(): number {
    return this.getPos()
  }

  editSource = (): void => {
    this.manuallyCollapsed = false
    this.focusOpen = true
    this.applyMode()
    this.focusCodeMirrorAtStoredPosition()
  }

  setBehavior(behavior: LivePreviewBlockBehavior): void {
    if (this.behavior === behavior) {
      return
    }

    this.behavior = behavior
    this.manuallyCollapsed = false
    this.dom.dataset.behavior = behavior
    this.applyMode()
  }

  stopEvent(event: Event): boolean {
    return shouldStopNodeViewEvent(event, this.view, this.getPos, this.node)
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
    if (this.focusFrame !== undefined) {
      cancelAnimationFrame(this.focusFrame)
    }
    if (this.collapseFrame !== undefined) {
      cancelAnimationFrame(this.collapseFrame)
    }
    this.stopWaitingForWindowFocus()
    this.setFullscreen(false)
    unregisterLivePreviewBehaviorTarget(this.view, this)
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
        onSearchActiveChange: this.handleSearchActiveChange,
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
    const staging = document.createElement('div')
    try {
      await this.renderer.render(content, staging, {
        node: this.node,
        view: this.view,
      })
      if (this.destroying || version !== this.renderVersion) return
      this.previewElt.classList.remove('mf-live-preview-render-error')
      this.previewElt.replaceChildren(...staging.childNodes)
    } catch (err) {
      if (this.destroying || version !== this.renderVersion) return
      const errorCard = document.createElement('div')
      errorCard.className = 'mf-live-preview-error-card'
      const error = document.createElement('pre')
      error.className = 'mf-live-preview-error'
      error.textContent = err instanceof Error ? err.message : String(err)
      const editButton = document.createElement('button')
      editButton.className = 'mf-live-preview-error-action'
      editButton.type = 'button'
      editButton.textContent = 'Edit source'
      editButton.addEventListener('click', this.handleErrorEdit)
      errorCard.append(error, editButton)
      this.previewElt.replaceChildren(errorCard)
      this.previewElt.classList.add('mf-live-preview-render-error')
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

    if (this.mode === 'preview') {
      this.editSource()
      return
    }

    this.recordCodeMirrorSelection()
    this.manuallyCollapsed = true
    this.focusOpen = false
    this.applyMode()
  }

  private collapseSource = (event: MouseEvent): void => {
    event.preventDefault()
    event.stopPropagation()

    if (this.mode === 'preview' || this.searchOpen) {
      return
    }

    this.recordCodeMirrorSelection()
    this.manuallyCollapsed = true
    this.focusOpen = false
    this.toggleButton.focus()
    this.applyMode()
  }

  private applyMode(): void {
    const previousMode = this.mode
    this.mode = this.resolveMode()
    this.dom.dataset.mode = this.mode
    const previewOnly = this.mode === 'preview'
    const searchLocked = this.searchOpen
    const label = searchLocked
      ? 'Source shown for search result'
      : previewOnly
        ? 'Edit source'
        : 'Hide source'
    this.setToolbarButtonContent(
      this.toggleButton,
      previewOnly || searchLocked ? 'ri-code-s-slash-line' : 'ri-eye-line',
      label,
    )
    this.toggleButton.disabled = searchLocked
    this.toggleButton.setAttribute('aria-expanded', String(!previewOnly))
    this.toggleButton.setAttribute('aria-controls', this.editorElt.id)
    this.collapseButton.hidden = previewOnly || searchLocked
    this.editorElt.setAttribute('aria-hidden', String(previewOnly))

    if (previousMode === 'preview' && this.mode === 'split') {
      this.requestCodeMirrorMeasure()
    }
  }

  private toggleFullscreen = (event: MouseEvent): void => {
    event.preventDefault()
    event.stopPropagation()
    this.setFullscreen(!this.fullscreen)
  }

  private setFullscreen(fullscreen: boolean): void {
    if (this.fullscreen === fullscreen) {
      return
    }

    if (fullscreen) {
      this.focusOpen = true
    } else {
      this.recordCodeMirrorSelection()
      this.focusOpen = false
    }

    this.fullscreen = fullscreen
    this.applyMode()
    this.dom.classList.toggle('mf-live-preview-fullscreen', this.fullscreen)
    this.setToolbarButtonContent(
      this.fullscreenButton,
      this.fullscreen ? 'ri-fullscreen-exit-line' : 'ri-fullscreen-line',
      this.fullscreen ? 'Exit fullscreen' : 'Fullscreen',
    )
    const method = this.fullscreen ? 'addEventListener' : 'removeEventListener'
    document[method]('keydown', this.handleDocumentKeydown as EventListener, true)

    // Dispatch custom event so the host app can adjust UI (e.g., lower sidebar/statusbar z-index)
    document.dispatchEvent(
      new CustomEvent('mf:livepreview-fullscreen', { detail: { fullscreen: this.fullscreen } }),
    )

    if (this.fullscreen && this.mode !== 'preview') {
      this.focusCodeMirrorAtStoredPosition()
    }
  }

  private handleDocumentKeydown = (event: KeyboardEvent): void => {
    if (!this.fullscreen || event.key !== 'Escape') {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    this.setFullscreen(false)
    if (this.mode === 'preview') {
      this.fullscreenButton.focus()
    }
  }

  private handleKeydown = (event: KeyboardEvent): void => {
    if (
      event.defaultPrevented ||
      event.isComposing ||
      event.key !== 'Escape' ||
      this.fullscreen ||
      this.mode === 'preview' ||
      !this.isEventFromEditor(event)
    ) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    this.recordCodeMirrorSelection()
    this.manuallyCollapsed = true
    this.focusOpen = false
    this.applyMode()

    const pos = this.getPos()
    const tr = this.view.state.tr.setSelection(NodeSelection.create(this.view.state.doc, pos))
    this.view.dispatch(tr.scrollIntoView())
    this.view.focus()
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

  private stopToolbarMouseDown = (event: MouseEvent): void => {
    event.stopPropagation()
  }

  private recordCodeMirrorSelection(): void {
    if (!this.cmView) {
      return
    }
    this.lastCodeMirrorSelectionHead = this.cmView.state.selection.main.head
  }

  private focusCodeMirrorAtStoredPosition(): void {
    if (!this.cmView || !isBrowser()) {
      return
    }
    if (this.focusFrame !== undefined) {
      cancelAnimationFrame(this.focusFrame)
    }
    this.focusFrame = requestAnimationFrame(() => {
      this.focusFrame = undefined
      if (!this.cmView || this.mode === 'preview' || this.destroying) {
        return
      }

      this.cmView.requestMeasure()
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

  private handleFocusIn = (event: FocusEvent): void => {
    if (!(event.target instanceof Node) || !this.editorElt.contains(event.target)) {
      return
    }

    this.manuallyCollapsed = false
    this.focusOpen = true
    this.applyMode()
  }

  private handleFocusOut = (): void => {
    this.scheduleCollapseCheck()
  }

  private scheduleCollapseCheck(): void {
    if (!isBrowser()) {
      return
    }
    if (this.collapseFrame !== undefined) {
      cancelAnimationFrame(this.collapseFrame)
    }

    this.collapseFrame = requestAnimationFrame(() => {
      this.collapseFrame = undefined
      if (this.destroying || this.fullscreen) {
        return
      }
      if (!this.dom.ownerDocument.hasFocus()) {
        this.waitForWindowFocus()
        return
      }
      this.stopWaitingForWindowFocus()

      const activeElement = this.view.root?.activeElement ?? this.dom.ownerDocument.activeElement
      if (
        (activeElement && this.dom.contains(activeElement)) ||
        this.cmView?.hasFocus
      ) {
        return
      }

      this.recordCodeMirrorSelection()
      this.focusOpen = false
      this.applyMode()
    })
  }

  private waitForWindowFocus(): void {
    if (this.waitingForWindowFocus) {
      return
    }
    this.waitingForWindowFocus = true
    this.dom.ownerDocument.defaultView?.addEventListener('focus', this.handleWindowFocus, {
      once: true,
    })
  }

  private stopWaitingForWindowFocus(): void {
    if (!this.waitingForWindowFocus) {
      return
    }
    this.waitingForWindowFocus = false
    this.dom.ownerDocument.defaultView?.removeEventListener('focus', this.handleWindowFocus)
  }

  private handleWindowFocus = (): void => {
    this.waitingForWindowFocus = false
    this.scheduleCollapseCheck()
  }

  private handleSearchActiveChange = (active: boolean): void => {
    this.searchOpen = active
    this.applyMode()
  }

  private handleErrorEdit = (event: MouseEvent): void => {
    event.preventDefault()
    event.stopPropagation()
    this.editSource()
  }

  private resolveMode(): LivePreviewMode {
    const alwaysSplit = this.behavior === 'always-split' && !this.manuallyCollapsed
    return alwaysSplit || this.focusOpen || this.searchOpen ? 'split' : 'preview'
  }

  private requestCodeMirrorMeasure(): void {
    this.cmView?.requestMeasure()
  }

  private isEventFromEditor(event: Event): boolean {
    return event.target instanceof Node && this.editorElt.contains(event.target)
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
    this.setToolbarButtonContent(this.copyButton, 'ri-check-line', 'Copied')
    setTimeout(() => {
      if (!this.destroying) {
        this.setToolbarButtonContent(this.copyButton, 'ri-file-copy-line', 'Copy source')
      }
    }, 1200)
  }

  private createToolbarButton(icon: string, title: string): HTMLButtonElement {
    const button = document.createElement('button')
    button.className = 'mf-live-preview-tool'
    button.type = 'button'
    this.setToolbarButtonContent(button, icon, title)
    return button
  }

  private setToolbarButtonContent(
    button: HTMLButtonElement,
    icon: string,
    label: string,
  ): void {
    const iconElt = document.createElement('i')
    iconElt.className = icon
    iconElt.setAttribute('aria-hidden', 'true')
    button.replaceChildren(iconElt)
    button.title = label
    button.setAttribute('aria-label', label)
  }
}

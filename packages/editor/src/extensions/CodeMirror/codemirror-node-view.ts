import type { LanguageSupport } from '@codemirror/language'
import type { Extension as CodeMirrorExtension } from '@codemirror/state'
import type { EditorView as CodeMirrorEditorView } from '@codemirror/view'
import type { EditorView, NodeView, ProsemirrorNode } from '@remirror/pm'
import MfCodemirrorView from '@/codemirror/codemirror'

export type LoadLanguage = (lang: string) => Promise<LanguageSupport> | LanguageSupport | void

export class CodeMirror6NodeView implements NodeView {
  public dom: HTMLElement
  private node: ProsemirrorNode
  private readonly view: EditorView
  private readonly getPos: () => number
  private readonly cm: CodeMirrorEditorView
  private readonly mfCodemirrorView: MfCodemirrorView
  private languageName: string

  constructor({
    node,
    view,
    getPos,
    extensions,
  }: {
    node: ProsemirrorNode
    view: EditorView
    getPos: () => number
    extensions: CodeMirrorExtension[] | null
    toggleName: string
  }) {
    this.node = node
    this.view = view
    this.getPos = getPos
    this.languageName = ''

    this.mfCodemirrorView = new MfCodemirrorView({
      view: this.view,
      getPos: this.getPos,
      node: this.node,
      extensions,
      languageName: this.languageName,
    })
    // Create a CodeMirror instance
    this.cm = this.mfCodemirrorView.cm

    // The editor's outer node is our DOM representation
    this.dom = this.cm.dom
  }

  update(node: ProsemirrorNode): boolean {
    this.node = node
    return this.mfCodemirrorView.update(node)
  }

  /**
   * Synchronize the selections from ProseMirror to CodeMirrror
   */
  setSelection(anchor: number, head: number): void {
    this.mfCodemirrorView.setSelection(anchor, head)
  }

  selectNode(): void {
    this.focus()
  }

  focus(): void {
    this.cm.focus()
    this.mfCodemirrorView.forwardSelection()
  }

  stopEvent(): boolean {
    return true
  }

  destroy(): void {
    this.mfCodemirrorView.destroy()
  }
}

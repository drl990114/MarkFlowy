import type { Extension as CodeMirrorExtension } from '@codemirror/state'
import type { EditorView, ProsemirrorNode } from '@rme-sdk/sdk/pm'
import type { CustomCopyFunction } from '../CodeMirror/codemirror-types'

export type LivePreviewMode = 'split' | 'preview'
export type LivePreviewBlockBehavior = 'auto' | 'always-split'

export interface LivePreviewRenderContext {
  node: ProsemirrorNode
  view: EditorView
}

export interface LivePreviewRenderer {
  languageName: string
  displayName: string
  className: string
  getCodeMirrorExtensions: () => CodeMirrorExtension[]
  render: (
    content: string,
    container: HTMLElement,
    context: LivePreviewRenderContext,
  ) => void | Promise<void>
  onMount?: (view: LivePreviewNodeViewApi) => void
  onDestroy?: (view: LivePreviewNodeViewApi) => void
}

export interface LivePreviewNodeViewApi {
  render: () => void
}

export interface LivePreviewNodeViewOptions {
  node: ProsemirrorNode
  view: EditorView
  getPos: () => number
  renderer: LivePreviewRenderer
  customCopyFunction?: CustomCopyFunction
  behavior?: LivePreviewBlockBehavior
  defaultMode?: LivePreviewMode
  openOnMount?: boolean
}

export interface LivePreviewBlockCommonOptions {
  customCopyFunction?: CustomCopyFunction
  codemirrorExtensions?: CodeMirrorExtension[]
  /**
   * `auto` shows source only for the active block. `always-split` defaults to
   * showing source and preview side by side, while allowing a block to be
   * collapsed manually.
   * @default 'auto'
   */
  behavior?: LivePreviewBlockBehavior
}

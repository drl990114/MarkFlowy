import type { Extension as CodeMirrorExtension } from '@codemirror/state'
import type { EditorView, ProsemirrorNode } from '@rme-sdk/pm'
import type { MfCodemirrorView } from '../../codemirror'
import type { CustomCopyFunction } from '../CodeMirror/codemirror-types'

export type LivePreviewMode = 'split' | 'preview'

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
  defaultMode?: LivePreviewMode
  openOnMount?: boolean
}

export interface LivePreviewBlockCommonOptions {
  customCopyFunction?: CustomCopyFunction
  codemirrorExtensions?: CodeMirrorExtension[]
}

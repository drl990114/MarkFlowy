import type { EditorLayoutNode } from '@/stores/useEditorStore'

export function isSingleDocumentLayout(rootPath: string | undefined, layout: EditorLayoutNode) {
  return !rootPath && layout.type === 'leaf' && layout.opened.length === 1
}

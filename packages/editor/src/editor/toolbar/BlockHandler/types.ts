import type { EditorView, ProsemirrorNode } from '@rme-sdk/core'

export interface NodeTransformContext {
  view: EditorView
  pos: number
  node: ProsemirrorNode
  tr: any
}

export interface BlockTypeOption {
  key: string
  label: string
  icon: string
  group: 'transform' | 'actions'
  isActive?: (node: ProsemirrorNode) => boolean
  isAvailable?: (node: ProsemirrorNode) => boolean
  transform?: (context: NodeTransformContext) => boolean
  action?: (context: NodeTransformContext) => boolean
}

export interface BlockTypeGroup {
  key: string
  label: string
  children: BlockTypeOption[]
}

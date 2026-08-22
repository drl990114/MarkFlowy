import type { EditorView, ProsemirrorNode } from '@rme-sdk/sdk/core'

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
  isActive?: (context: NodeTransformContext) => boolean
  isAvailable?: (context: NodeTransformContext) => boolean
  transform?: (context: NodeTransformContext) => boolean
  action?: (context: NodeTransformContext) => boolean
}

export interface BlockTypeGroup {
  key: string
  label: string
  children: BlockTypeOption[]
}

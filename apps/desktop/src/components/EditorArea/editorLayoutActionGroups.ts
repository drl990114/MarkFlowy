import type { EditorLayoutNode } from '@/stores/useEditorStore'

export function getTopEditorGroupId(
  node: EditorLayoutNode,
  edge: 'left' | 'right',
): string | undefined {
  if (node.type === 'leaf') return node.id

  const child =
    node.direction === 'horizontal'
      ? edge === 'left'
        ? node.children[0]
        : node.children[node.children.length - 1]
      : node.children[0]

  return child ? getTopEditorGroupId(child, edge) : undefined
}

export function containsEditorGroup(node: EditorLayoutNode, groupId?: string): boolean {
  if (!groupId) return false
  if (node.type === 'leaf') return node.id === groupId

  return node.children.some((child) => containsEditorGroup(child, groupId))
}

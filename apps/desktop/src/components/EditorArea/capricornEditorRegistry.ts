import type { CapricornRuntimeAdapter } from './capricornRuntimeAdapter'

const currentEditors = new Map<string, CapricornRuntimeAdapter>()
const listeners = new Set<() => void>()

const notify = () => listeners.forEach((listener) => listener())

export function getCapricornEditor(fileId: string): CapricornRuntimeAdapter | undefined {
  return currentEditors.get(fileId)
}

export function setCapricornEditor(
  fileId: string,
  editor: CapricornRuntimeAdapter | undefined,
): void {
  if (currentEditors.get(fileId) === editor) return

  if (editor) currentEditors.set(fileId, editor)
  else currentEditors.delete(fileId)
  notify()
}

export function subscribeCapricornEditors(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

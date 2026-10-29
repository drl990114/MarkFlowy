import type { CapricornRuntimeAdapter } from './capricornRuntimeAdapter'
import { InstanceResourceRegistry } from './instanceResourceRegistry'

export const capricornEditorInstanceRegistry = new InstanceResourceRegistry<CapricornRuntimeAdapter>()

const currentEditors = new Map<string, CapricornRuntimeAdapter>()
const listeners = new Set<() => void>()

const notify = () => listeners.forEach((listener) => listener())

export function getCapricornEditor(
  fileId: string,
  groupId?: string,
): CapricornRuntimeAdapter | undefined {
  return groupId === undefined
    ? currentEditors.get(fileId)
    : capricornEditorInstanceRegistry.getForGroup(fileId, groupId)
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
  const unsubscribeInstances = capricornEditorInstanceRegistry.subscribe(listener)
  return () => {
    listeners.delete(listener)
    unsubscribeInstances()
  }
}

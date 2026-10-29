import type { MfCodemirrorView } from 'rme'
import { SourceFind } from './sourceCodeFind'
import { sourceCodeCodemirrorViewMap } from './sourceCodeEditorInstances'
import { InstanceResourceRegistry } from './instanceResourceRegistry'
export { sourceCodeCodemirrorViewMap } from './sourceCodeEditorInstances'

export const sourceCodeViewRegistry = new InstanceResourceRegistry<MfCodemirrorView>()

export function getSourceCodeEditor(fileId: string, groupId?: string): MfCodemirrorView | undefined {
  return groupId === undefined
    ? sourceCodeCodemirrorViewMap.get(fileId)
    : sourceCodeViewRegistry.getForGroup(fileId, groupId)
}

const findApis = new WeakMap<MfCodemirrorView, SourceFind>()
export function getSourceCodeFind(editor: MfCodemirrorView) {
  return findApis.get(editor)
}

const listeners = new Set<() => void>()

export function setSourceCodeEditor(id: string, editor: MfCodemirrorView | undefined) {
  if (sourceCodeCodemirrorViewMap.get(id) === editor) return
  const previous = sourceCodeCodemirrorViewMap.get(id)
  if (previous) {
    findApis.get(previous)?.destroy()
    findApis.delete(previous)
  }
  if (editor) {
    findApis.set(
      editor,
      new SourceFind(editor.cm, (query, active) => editor.setSearchState(query, active)),
    )
    sourceCodeCodemirrorViewMap.set(id, editor)
  } else sourceCodeCodemirrorViewMap.delete(id)
  listeners.forEach((listener) => listener())
}

export function subscribeSourceCodeEditors(listener: () => void) {
  listeners.add(listener)
  const unsubscribeInstances = sourceCodeViewRegistry.subscribe(listener)
  return () => {
    listeners.delete(listener)
    unsubscribeInstances()
  }
}

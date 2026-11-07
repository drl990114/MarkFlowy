import type { MfCodemirrorView } from 'rme'
import { InstanceResourceRegistry } from './instanceResourceRegistry'

// Reading an existing source selection must not load the source editor/search engine.
export const sourceCodeCodemirrorViewMap = new Map<string, MfCodemirrorView>()
export const sourceCodeViewRegistry = new InstanceResourceRegistry<MfCodemirrorView>()

export function getSourceCodeEditor(fileId: string, groupId?: string): MfCodemirrorView | undefined {
  return groupId === undefined
    ? sourceCodeCodemirrorViewMap.get(fileId)
    : sourceCodeViewRegistry.getForGroup(fileId, groupId)
}

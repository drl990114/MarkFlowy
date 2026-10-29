import { create } from 'zustand'
import { EditorViewType, type EditorViewTypeValue } from '@/constants/editorViewType'
import { immer } from 'zustand/middleware/immer'

const useEditorViewTypeStore = create(
  immer<EditorViewTypeStore>((set, get) => {
    return {
      editorViewTypeMap: new Map(),
      editorGroupViewTypeMap: new Map(),

      setEditorViewType: (id, viewType, groupId) =>
        set((state) => {
          if (groupId) {
            const modes = state.editorGroupViewTypeMap.get(groupId) ?? new Map()
            modes.set(id, viewType)
            state.editorGroupViewTypeMap.set(groupId, modes)
          } else {
            state.editorViewTypeMap.set(id, viewType)
          }
        }),

      getEditorViewType: (id, groupId) =>
        selectEditorViewType(get(), id, groupId) ?? EditorViewType.PREVIEW,

      pruneGroupEditorViewTypes: (groups) => {
        if (!get().editorGroupViewTypeMap.size) return
        set((state) => {
          const openedByGroup = new Map(groups.map((group) => [group.id, new Set(group.opened)]))
          for (const [groupId, modes] of state.editorGroupViewTypeMap) {
            const opened = openedByGroup.get(groupId)
            for (const id of modes.keys()) {
              if (!opened?.has(id)) modes.delete(id)
            }
            if (!modes.size) state.editorGroupViewTypeMap.delete(groupId)
          }
        })
      },
    }
  }),
)

type EditorViewTypeStore = {
  /** Compatibility view for active-editor consumers and new pane defaults. */
  editorViewTypeMap: Map<string, EditorViewTypeValue>
  editorGroupViewTypeMap: Map<string, Map<string, EditorViewTypeValue>>
  setEditorViewType: (id: string, viewType: EditorViewTypeValue, groupId?: string) => void
  getEditorViewType: (id: string, groupId?: string) => EditorViewTypeValue
  pruneGroupEditorViewTypes: (groups: { id: string; opened: readonly string[] }[]) => void
}

export function selectEditorViewType(state: EditorViewTypeStore, id: string, groupId?: string) {
  return (groupId ? state.editorGroupViewTypeMap.get(groupId)?.get(id) : undefined) ??
    state.editorViewTypeMap.get(id)
}

export default useEditorViewTypeStore

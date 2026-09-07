import { create } from 'zustand'
import useEditorStore from '@/stores/useEditorStore'
import useEditorViewTypeStore from '@/stores/useEditorViewTypeStore'
import { EditorViewType, type EditorViewTypeValue } from '@/constants/editorViewType'
import type { EditorSourceMatchRequest } from './capricornRuntimeAdapter'

export interface SearchNavigationRequest extends EditorSourceMatchRequest {
  fileId: string
  path: string
  groupId?: string
  requestId: number
  mode?: EditorViewTypeValue
}

interface EditorSearchState {
  owner: 'document' | 'global' | null
  generation: number
  focusRevision: number
  focusedRevision: number
  query: string
  replacement: string
  caseSensitive: boolean
  composing: boolean
  navigation: SearchNavigationRequest | null
  error: 'unsupported' | 'stale' | 'failed' | null
}

export const useEditorSearchStore = create<EditorSearchState>(() => ({
  owner: null,
  generation: 0,
  focusRevision: 0,
  focusedRevision: 0,
  query: '',
  replacement: '',
  caseSensitive: false,
  composing: false,
  navigation: null,
  error: null,
}))

export function openDocumentSearch(): boolean {
  const { activeId } = useEditorStore.getState()
  if (
    !activeId ||
    useEditorViewTypeStore.getState().editorViewTypeMap.get(activeId) === EditorViewType.PREVIEW
  )
    return false
  useEditorSearchStore.setState((state) => ({
    owner: 'document',
    generation: state.owner === 'document' ? state.generation : state.generation + 1,
    composing: state.owner === 'document' ? state.composing : false,
    focusRevision: state.focusRevision + 1,
    navigation: null,
    error: null,
  }))
  return true
}

export function requestSearchNavigation(
  target: Omit<SearchNavigationRequest, 'requestId' | 'groupId' | 'mode'>,
) {
  useEditorSearchStore.setState((state) => ({
    owner: 'global',
    generation: state.generation + 1,
    composing: false,
    error: null,
    navigation: {
      ...target,
      requestId: state.generation + 1,
      groupId: useEditorStore.getState().activeGroupId,
      mode: useEditorViewTypeStore.getState().editorViewTypeMap.get(target.fileId),
    },
  }))
}

export function closeEditorSearch(owner?: EditorSearchState['owner']) {
  if (owner && useEditorSearchStore.getState().owner !== owner) return
  useEditorSearchStore.setState((state) => ({
    owner: null,
    navigation: null,
    composing: false,
    error: null,
    generation: state.generation + 1,
  }))
}

export function reportEditorSearchLoadFailure(fileId: string, groupId?: string) {
  const state = useEditorSearchStore.getState()
  const active = useEditorStore.getState()
  if (!state.owner || active.activeId !== fileId || active.activeGroupId !== groupId) return
  if (
    state.navigation &&
    (state.navigation.fileId !== fileId || state.navigation.groupId !== groupId)
  )
    return
  useEditorSearchStore.setState({
    error: 'failed',
    navigation: null,
    generation: state.generation + 1,
  })
}

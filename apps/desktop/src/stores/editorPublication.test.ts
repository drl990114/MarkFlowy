import { enableMapSet } from 'immer'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import useEditorCounterStore from './useEditorCounterStore'
import useEditorStateStore from './useEditorStateStore'

enableMapSet()

beforeEach(() => {
  useEditorStateStore.setState({ idStateMap: new Map() })
  useEditorCounterStore.setState({ editorCounterMap: {} })
})

describe('editor store publication', () => {
  it('publishes dirty transitions once while retaining undo changes and clean transitions', () => {
    const listener = vi.fn()
    const unsubscribe = useEditorStateStore.subscribe(listener)
    try {
      const { setIdStateMap } = useEditorStateStore.getState()
      setIdStateMap('file', { hasUnsavedChanges: true })
      const dirtySnapshot = useEditorStateStore.getState()
      for (let i = 0; i < 1000; i += 1) {
        setIdStateMap('file', { hasUnsavedChanges: true })
      }
      expect(listener).toHaveBeenCalledOnce()
      expect(useEditorStateStore.getState()).toBe(dirtySnapshot)

      setIdStateMap('file', { hasUnsavedChanges: true, undoDepth: 1 })
      setIdStateMap('file', { hasUnsavedChanges: true, undoDepth: 2 })
      setIdStateMap('file', { hasUnsavedChanges: false })
      expect(listener).toHaveBeenCalledTimes(4)
      expect(useEditorStateStore.getState().idStateMap.get('file')).toEqual({
        hasUnsavedChanges: false,
      })
      setIdStateMap('other', { hasUnsavedChanges: false })
      expect(listener).toHaveBeenCalledTimes(5)
    } finally {
      unsubscribe()
    }
  })

  it('does not broadcast identical counts but publishes each changed field and document', () => {
    const listener = vi.fn()
    const unsubscribe = useEditorCounterStore.subscribe(listener)
    const data = { characterCount: 100, nonWhitespaceCharacterCount: 90, wordCount: 20 }
    try {
      const { addEditorCounter, deleteEditorCounter } = useEditorCounterStore.getState()
      addEditorCounter({ id: 'file', data })
      const snapshot = useEditorCounterStore.getState()
      for (let i = 0; i < 100; i += 1) {
        addEditorCounter({ id: 'file', data: { ...data } })
      }
      expect(listener).toHaveBeenCalledOnce()
      expect(useEditorCounterStore.getState()).toBe(snapshot)

      addEditorCounter({ id: 'file', data: { ...data, characterCount: 101 } })
      addEditorCounter({ id: 'file', data: { ...data, nonWhitespaceCharacterCount: 91 } })
      addEditorCounter({ id: 'file', data: { ...data, wordCount: 21 } })
      addEditorCounter({ id: 'other', data })
      expect(listener).toHaveBeenCalledTimes(5)
      deleteEditorCounter({ id: 'file' })
      expect(listener).toHaveBeenCalledTimes(6)
      expect(useEditorCounterStore.getState().editorCounterMap.file).toBeUndefined()
      expect(useEditorCounterStore.getState().editorCounterMap.other).toEqual(data)
    } finally {
      unsubscribe()
    }
  })
})

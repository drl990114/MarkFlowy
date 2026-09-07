import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { enableMapSet } from 'immer'
import { StrictMode } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import type { MfCodemirrorView } from 'rme'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import useEditorStore from '@/stores/useEditorStore'
import useEditorViewTypeStore from '@/stores/useEditorViewTypeStore'
import { EditorViewType } from '@/constants/editorViewType'
import { setCapricornEditor } from '../../capricornEditorRegistry'
import type {
  CapricornFindApi,
  CapricornFindState,
  CapricornRuntimeAdapter,
  EditorSourceMatchResult,
} from '../../capricornRuntimeAdapter'
import {
  closeEditorSearch,
  openDocumentSearch,
  reportEditorSearchLoadFailure,
  requestSearchNavigation,
  useEditorSearchStore,
} from '../../editorSearchStore'
import { useEditorSearchController } from './use-editor-search'
import { setSourceCodeEditor, getSourceCodeFind } from '../../sourceCodeEditorRegistry'

enableMapSet()
const target = {
  fileId: 'first',
  path: '/first.md',
  line: 1,
  lineText: 'foo foo',
  query: 'foo',
  startColumn: 4,
  endColumn: 7,
}
function createApi() {
  let state: CapricornFindState = {
    activeIndex: undefined,
    query: '',
    caseSensitive: false,
    matches: [],
  }
  const listeners = new Set<(state: CapricornFindState) => void>()
  const publish = (patch: Partial<CapricornFindState>) => {
    state = { ...state, ...patch }
    listeners.forEach((listener) => listener(state))
    return state
  }
  const api: CapricornFindApi = {
    clear: vi.fn(() => publish({ query: '', matches: [] })),
    close: vi.fn(() => publish({ query: '', matches: [] })),
    getState: () => state,
    open: vi.fn(() => state),
    search: vi.fn((request) => publish({ ...request, matches: [] })),
    searchAsync: vi.fn(async (request) => publish({ ...request, matches: [] })),
    navigateTo: vi.fn(async () => null),
    next: vi.fn(async () => null),
    previous: vi.fn(async () => null),
    revealSourceMatch: vi.fn(async () => ({ status: 'exact' as const })),
    replace: vi.fn(async () => true),
    replaceAll: vi.fn(() => 0),
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
  return api
}
function register(api: CapricornFindApi, id = 'first') {
  act(() => setCapricornEditor(id, { find: api } as unknown as CapricornRuntimeAdapter))
}
beforeEach(() => {
  useEditorStore.setState({ activeId: 'first', activeGroupId: 'main' })
  useEditorViewTypeStore.getState().setEditorViewType('first', EditorViewType.WYSIWYG)
  useEditorViewTypeStore.getState().setEditorViewType('second', EditorViewType.WYSIWYG)
  useEditorSearchStore.setState({
    owner: null,
    query: '',
    composing: false,
    navigation: null,
    error: null,
  })
})
afterEach(() => {
  cleanup()
  closeEditorSearch()
  setCapricornEditor('first', undefined)
  setCapricornEditor('second', undefined)
})

describe('editor search request ownership', () => {
  it('uses the same host controller for Source Code without stealing input focus', async () => {
    const native = new EditorView({
      state: EditorState.create({ doc: 'foo foo' }),
      parent: document.body,
    })
    const source = { cm: native, setSearchState: vi.fn() } as unknown as MfCodemirrorView
    useEditorViewTypeStore.getState().setEditorViewType('first', EditorViewType.SOURCECODE)
    setSourceCodeEditor('first', source)
    const hook = renderHook(useEditorSearchController)
    const input = document.createElement('input')
    document.body.append(input)
    input.focus()
    try {
      act(() => {
        openDocumentSearch()
        hook.result.current.setQuery('foo')
      })
      await waitFor(() => expect(hook.result.current.total).toBe(2))
      act(() => hook.result.current.findNext())
      await waitFor(() => expect(native.state.selection.main.from).toBe(4))
      expect(document.activeElement).toBe(input)
      act(() => requestSearchNavigation({ ...target, startColumn: 0, endColumn: 3 }))
      await waitFor(() => expect(native.state.selection.main.from).toBe(0))
      expect(getSourceCodeFind(source)?.getState().matches).toHaveLength(1)
      expect(useEditorViewTypeStore.getState().editorViewTypeMap.get('first')).toBe(
        EditorViewType.SOURCECODE,
      )
    } finally {
      hook.unmount()
      setSourceCodeEditor('first', undefined)
      native.destroy()
      input.remove()
    }
  })
  it('waits for a ready instance and applies a global request only once in StrictMode', async () => {
    const hook = renderHook(useEditorSearchController, { wrapper: StrictMode })
    act(() => requestSearchNavigation(target))
    const api = createApi()
    register(api)
    await waitFor(() => expect(api.revealSourceMatch).toHaveBeenCalledTimes(1))
    expect(api.search).not.toHaveBeenCalled()
    hook.rerender()
    expect(api.revealSourceMatch).toHaveBeenCalledTimes(1)
  })

  it('aborts rapid cross-file navigation and ignores the old failure', async () => {
    const first = createApi()
    let finish!: (result: EditorSourceMatchResult) => void
    vi.mocked(first.revealSourceMatch!).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    register(first)
    const second = createApi()
    register(second, 'second')
    renderHook(useEditorSearchController)
    act(() => requestSearchNavigation(target))
    await waitFor(() => expect(first.revealSourceMatch).toHaveBeenCalledOnce())
    act(() => {
      useEditorStore.setState({ activeId: 'second' })
      requestSearchNavigation({ ...target, fileId: 'second', path: '/second.md' })
    })
    await waitFor(() => expect(second.revealSourceMatch).toHaveBeenCalledOnce())
    expect(vi.mocked(first.revealSourceMatch!).mock.calls[0][1]?.signal?.aborted).toBe(true)
    await act(async () => finish({ status: 'stale' }))
    expect(useEditorSearchStore.getState().error).toBeNull()
  })

  it.each(['replacement', 're-registration'])(
    'reveals the same request after instance %s',
    async (change) => {
      const first = createApi()
      register(first)
      renderHook(useEditorSearchController)
      act(() => requestSearchNavigation(target))
      await waitFor(() => expect(first.revealSourceMatch).toHaveBeenCalledOnce())

      const current = change === 'replacement' ? createApi() : first
      if (change === 're-registration') act(() => setCapricornEditor('first', undefined))
      register(current)
      await waitFor(() =>
        expect(current.revealSourceMatch).toHaveBeenCalledTimes(change === 'replacement' ? 1 : 2),
      )
      expect(useEditorSearchStore.getState().navigation?.fileId).toBe('first')
      expect(useEditorSearchStore.getState().error).toBeNull()
    },
  )

  it.each(['close', 'group', 'mode', 'destroy', 'load failure'])(
    'cancels a pending request on %s',
    async (action) => {
      const api = createApi()
      vi.mocked(api.revealSourceMatch!).mockImplementation(() => new Promise(() => {}))
      register(api)
      renderHook(useEditorSearchController)
      act(() => requestSearchNavigation(target))
      await waitFor(() => expect(api.revealSourceMatch).toHaveBeenCalledOnce())
      act(() => {
        if (action === 'close') closeEditorSearch()
        if (action === 'group') useEditorStore.setState({ activeGroupId: 'second-pane' })
        if (action === 'mode')
          useEditorViewTypeStore.getState().setEditorViewType('first', EditorViewType.SOURCECODE)
        if (action === 'destroy') setCapricornEditor('first', undefined)
        if (action === 'load failure') reportEditorSearchLoadFailure('first', 'main')
      })
      expect(vi.mocked(api.revealSourceMatch!).mock.calls[0][1]?.signal?.aborted).toBe(true)
      if (action === 'load failure') expect(useEditorSearchStore.getState().error).toBe('failed')
    },
  )

  it('does not let old component cleanup close a new owner of the same instance', async () => {
    const api = createApi()
    register(api)
    act(() => openDocumentSearch())
    const old = renderHook(useEditorSearchController)
    const current = renderHook(useEditorSearchController)
    vi.mocked(api.close).mockClear()
    old.unmount()
    expect(api.close).not.toHaveBeenCalled()
    act(() => current.result.current.setQuery('second'))
    await waitFor(() => expect(api.getState().query).toBe('second'))
    current.unmount()
    expect(api.close).toHaveBeenCalledOnce()
  })

  it('debounces query drafts, preserves repeated-open text, and checks old package capabilities', async () => {
    const api = createApi()
    api.revealSourceMatch = undefined
    register(api)
    const hook = renderHook(useEditorSearchController)
    act(() => requestSearchNavigation(target))
    await waitFor(() => expect(useEditorSearchStore.getState().error).toBe('unsupported'))
    act(() => {
      openDocumentSearch()
      hook.result.current.setQuery('f')
    })
    act(() => hook.result.current.setQuery('foo'))
    act(() => openDocumentSearch())
    await waitFor(() => expect(api.searchAsync).toHaveBeenCalledOnce())
    expect(api.getState().query).toBe('foo')
    act(() => closeEditorSearch('global'))
    expect(useEditorSearchStore.getState().owner).toBe('document')
  })
})

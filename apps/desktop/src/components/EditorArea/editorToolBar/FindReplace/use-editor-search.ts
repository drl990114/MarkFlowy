import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import useEditorStore from '@/stores/useEditorStore'
import useEditorViewTypeStore from '@/stores/useEditorViewTypeStore'
import { EditorViewType } from '@/constants/editorViewType'
import { getCapricornEditor, subscribeCapricornEditors } from '../../capricornEditorRegistry'
import {
  sourceCodeCodemirrorViewMap,
  subscribeSourceCodeEditors,
  getSourceCodeFind,
} from '../../sourceCodeEditorRegistry'
import { closeEditorSearch, useEditorSearchStore } from '../../editorSearchStore'
import type { CapricornFindApi, CapricornFindState } from '../../capricornRuntimeAdapter'

type FindApi = Omit<CapricornFindApi, 'search' | 'replaceAll'> & {
  search?: CapricornFindApi['search']
  replaceAll: (replacement: string) => number | Promise<number>
}
// An older React tree may unmount after a replacement has claimed the same
// editor. Leases scope cleanup and cancellation to the actual owner.
const leases = new WeakMap<FindApi, { token: symbol; release: () => void }>()

export function useEditorSearchController() {
  const state = useEditorSearchStore()
  const activeId = useEditorStore((store) => store.activeId)
  const groupId = useEditorStore((store) => store.activeGroupId)
  const mode = useEditorViewTypeStore((store) =>
    activeId ? store.editorViewTypeMap.get(activeId) : undefined,
  )
  const capricornSnapshot = useCallback(
    () => (activeId ? getCapricornEditor(activeId) : undefined),
    [activeId],
  )
  const sourceSnapshot = useCallback(
    () => (activeId ? sourceCodeCodemirrorViewMap.get(activeId) : undefined),
    [activeId],
  )
  const capricorn = useSyncExternalStore(
    subscribeCapricornEditors,
    capricornSnapshot,
    capricornSnapshot,
  )
  const source = useSyncExternalStore(subscribeSourceCodeEditors, sourceSnapshot, sourceSnapshot)
  const api: FindApi | undefined =
    mode === EditorViewType.PREVIEW
      ? undefined
      : mode === EditorViewType.SOURCECODE
        ? source
          ? getSourceCodeFind(source)
          : undefined
        : capricorn?.find
  const [summary, setSummary] = useState({ activeIndex: undefined as number | undefined, total: 0 })
  const operation = useRef<AbortController | null>(null)
  const ownership = useRef<{ api: FindApi; token: symbol } | null>(null)
  const navigationApplied = useRef<{ requestId: number; api: FindApi } | null>(null)

  const cancel = useCallback(() => {
    operation.current?.abort()
  }, [])
  const start = useCallback(() => {
    operation.current?.abort()
    const next = new AbortController()
    operation.current = next
    return next
  }, [])
  const report = useCallback((value: CapricornFindState) => {
    setSummary((previous) =>
      previous.activeIndex === value.activeIndex && previous.total === value.matches.length
        ? previous
        : { activeIndex: value.activeIndex, total: value.matches.length },
    )
  }, [])

  useEffect(() => {
    cancel()
    if (!api || !state.owner) {
      setSummary({ activeIndex: undefined, total: 0 })
      return
    }
    leases.get(api)?.release()
    const token = Symbol('editor-search')
    ownership.current = { api, token }
    const release = () => {
      if (leases.get(api)?.token !== token) return
      leases.delete(api)
      ownership.current = null
      // close() removes this instance's highlight. A later registration of the
      // same file or API must reveal the still-current request again.
      navigationApplied.current = null
      cancel()
      unsubscribe()
      try {
        api.close()
      } catch {
        /* The editor's passive cleanup may already have run. */
      }
    }
    leases.set(api, { token, release })
    if (state.owner === 'document') api.open({ replace: true })
    report(api.getState())
    const unsubscribe = api.subscribe(report)
    return release
  }, [api, activeId, groupId, state.owner, state.generation, cancel, report])

  const query = useCallback(
    async (signal: AbortSignal) => {
      const current = useEditorSearchStore.getState()
      if (
        !api ||
        ownership.current?.token !== leases.get(api)?.token ||
        signal.aborted ||
        current.owner !== 'document' ||
        current.composing
      )
        return null
      const request = { query: current.query, caseSensitive: current.caseSensitive }
      if (!request.query) return api.clear()
      if (api.searchAsync) return api.searchAsync(request, { signal })
      return api.search?.(request) ?? null
    },
    [api],
  )

  useEffect(() => {
    if (!api || state.owner !== 'document' || state.composing) return
    const abort = start()
    const timer = window.setTimeout(
      () => {
        void query(abort.signal)
          .then(async (result) => {
            if (!result || abort.signal.aborted) return
            report(result)
            if (result.matches.length && api.navigateTo)
              await api.navigateTo(result.activeIndex ?? 0, { signal: abort.signal })
          })
          .catch(() => {
            if (!abort.signal.aborted) useEditorSearchStore.setState({ error: 'failed' })
          })
      },
      state.query ? 100 : 0,
    )
    return () => {
      window.clearTimeout(timer)
      abort.abort()
    }
  }, [
    api,
    state.owner,
    state.generation,
    state.query,
    state.caseSensitive,
    state.composing,
    activeId,
    groupId,
    query,
    start,
    report,
  ])

  useEffect(() => {
    const target = state.navigation
    if (state.owner !== 'global' || !target) return
    if (
      activeId !== target.fileId ||
      groupId !== target.groupId ||
      mode === EditorViewType.PREVIEW ||
      (target.mode && mode && target.mode !== mode)
    ) {
      closeEditorSearch('global')
      return
    }
    if (
      !api ||
      (navigationApplied.current?.requestId === target.requestId &&
        navigationApplied.current.api === api)
    )
      return
    const abort = start()
    // Allow instance promotion and native/React readiness effects to finish.
    const timer = window.setTimeout(() => {
      if (abort.signal.aborted || ownership.current?.token !== leases.get(api)?.token) return
      navigationApplied.current = { requestId: target.requestId, api }
      if (!api.revealSourceMatch) {
        useEditorSearchStore.setState({ error: 'unsupported' })
        return
      }
      void api
        .revealSourceMatch(target, { signal: abort.signal })
        .then((result) => {
          if (abort.signal.aborted) return
          if (result?.status === 'stale' || result?.status === 'not-found')
            useEditorSearchStore.setState({ error: 'stale' })
        })
        .catch(() => {
          if (!abort.signal.aborted) useEditorSearchStore.setState({ error: 'failed' })
        })
    }, 0)
    return () => {
      window.clearTimeout(timer)
      abort.abort()
    }
  }, [api, activeId, groupId, mode, state.owner, state.navigation, start])

  const act = useCallback(
    (action: 'next' | 'previous' | 'replace' | 'replaceAll') => {
      if (!api) return
      const abort = start()
      void query(abort.signal)
        .then(async (result) => {
          if (!result || abort.signal.aborted) return
          const current = useEditorSearchStore.getState()
          if (action === 'replace') await api.replace(current.replacement)
          else if (action === 'replaceAll') await api.replaceAll(current.replacement)
          else if (api.navigateTo)
            await api.navigateTo(
              (result.activeIndex ?? (action === 'next' ? -1 : 0)) + (action === 'next' ? 1 : -1),
              { signal: abort.signal },
            )
          else if (action === 'next') await api.next()
          else await api.previous()
        })
        .catch(() => {
          if (!abort.signal.aborted) useEditorSearchStore.setState({ error: 'failed' })
        })
    },
    [api, query, start],
  )

  const stopFind = useCallback(() => {
    cancel()
    closeEditorSearch()
    if (mode === EditorViewType.SOURCECODE) source?.cm.focus()
    else capricorn?.focus()
  }, [cancel, mode, source, capricorn])

  return {
    ...state,
    ...summary,
    open: state.owner === 'document',
    available: !!api,
    setQuery: (value: string) => {
      cancel()
      useEditorSearchStore.setState({ query: value, error: null })
    },
    setReplacement: (value: string) => useEditorSearchStore.setState({ replacement: value }),
    toggleCaseSensitive: () => {
      cancel()
      useEditorSearchStore.setState((current) => ({ caseSensitive: !current.caseSensitive }))
    },
    setComposing: (value: boolean) => {
      cancel()
      useEditorSearchStore.setState({ composing: value })
    },
    findNext: () => act('next'),
    findPrev: () => act('previous'),
    replace: () => act('replace'),
    replaceAll: () => act('replaceAll'),
    stopFind,
  }
}

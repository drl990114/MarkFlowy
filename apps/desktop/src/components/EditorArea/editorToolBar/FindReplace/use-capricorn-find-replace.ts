import { commandRegistry } from '@/commands'
import { useCallback, useEffect, useState } from 'react'
import type { CapricornFindState, CapricornRuntimeAdapter } from '../../capricornRuntimeAdapter'

const EMPTY_FIND_STATE: CapricornFindState = {
  activeIndex: undefined,
  caseSensitive: false,
  matches: [],
  query: '',
}

export function useCapricornFindReplace(editor: CapricornRuntimeAdapter) {
  const [query, setQuery] = useState('')
  const [replacement, setReplacement] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [findState, setFindState] = useState<CapricornFindState>(() => editor.find.getState())

  useEffect(() => {
    setFindState(editor.find.getState())
    return editor.find.subscribe(setFindState)
  }, [editor])

  useEffect(() => {
    editor.find.open({ replace: true })
    setFindState(query ? editor.find.search({ caseSensitive, query }) : editor.find.clear())
  }, [caseSensitive, editor, query])

  const stopFind = useCallback(() => {
    setQuery('')
    setReplacement('')
    setCaseSensitive(false)
    setFindState(editor.find.close())
  }, [editor])

  useEffect(() => {
    const disposable = commandRegistry.registerCommand({
      id: 'app_stopFindEditor',
      handler: stopFind,
    })
    return () => disposable.dispose()
  }, [stopFind])

  const findNext = useCallback(() => {
    void editor.find.next()
  }, [editor])
  const findPrev = useCallback(() => {
    void editor.find.previous()
  }, [editor])
  const replace = useCallback(() => {
    void editor.find.replace(replacement)
  }, [editor, replacement])
  const replaceAll = useCallback(() => {
    editor.find.replaceAll(replacement)
  }, [editor, replacement])
  const toggleCaseSensitive = useCallback(() => {
    setCaseSensitive((current) => !current)
  }, [])

  const currentFindState = findState ?? EMPTY_FIND_STATE
  return {
    activeIndex: currentFindState.activeIndex ?? null,
    caseSensitive,
    findNext,
    findPrev,
    query,
    replace,
    replaceAll,
    replacement,
    setQuery,
    setReplacement,
    stopFind,
    toggleCaseSensitive,
    total: currentFindState.matches.length,
  }
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { createQuickOpenRanker, QUICK_OPEN_ASYNC_THRESHOLD } from './quickOpenRanker'
import { rankQuickOpenFiles, type QuickOpenFile } from './quickOpenRanking'

const EMPTY: QuickOpenFile[] = []

export function useQuickOpenRanking(
  files: QuickOpenFile[],
  query: string,
  recentIds: readonly string[],
) {
  const asynchronous = Boolean(query.trim()) && files.length >= QUICK_OPEN_ASYNC_THRESHOLD
  const ranker = useRef<ReturnType<typeof createQuickOpenRanker> | undefined>(undefined)
  const [result, setResult] = useState<{
    files: QuickOpenFile[]
    query: string
    recentIds: readonly string[]
    matches: QuickOpenFile[]
    failed?: boolean
  }>()
  const immediate = useMemo(
    () => (!asynchronous && query.trim() ? rankQuickOpenFiles(files, query, recentIds) : EMPTY),
    [asynchronous, files, query, recentIds],
  )
  useEffect(() => {
    if (!asynchronous) return
    const controller = new AbortController()
    ranker.current ??= createQuickOpenRanker()
    void ranker.current.rank(files, query, recentIds, controller.signal).then(
      (matches) => {
        if (!controller.signal.aborted) setResult({ files, query, recentIds, matches })
      },
      () => {
        if (!controller.signal.aborted)
          setResult({ files, query, recentIds, matches: [], failed: true })
      },
    )
    return () => controller.abort()
  }, [asynchronous, files, query, recentIds])
  useEffect(
    () => () => {
      ranker.current?.destroy()
      ranker.current = undefined
    },
    [],
  )
  const current =
    result?.files === files && result.query === query && result.recentIds === recentIds
  return {
    matches: asynchronous ? (current ? result.matches : EMPTY) : immediate,
    pending: asynchronous && !current,
    failed: asynchronous && current && result.failed,
  }
}

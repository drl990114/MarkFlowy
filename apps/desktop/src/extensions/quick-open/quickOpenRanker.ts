import {
  createQuickOpenCandidates,
  runQuickOpenRanking,
  type QuickOpenCandidate,
  type QuickOpenFile,
  type QuickOpenWorkerResult,
} from './quickOpenRanking'

export const QUICK_OPEN_ASYNC_THRESHOLD = 1000
const abortError = () => new DOMException('Search canceled.', 'AbortError')

/** One candidate transfer per dataset; queries and result indices stay small. */
export function createQuickOpenRanker(
  createWorker = () =>
    new Worker(new URL('./quickOpenRanking.worker.ts', import.meta.url), { type: 'module' }),
) {
  let worker: Worker | undefined
  let failed = false
  let destroyed = false
  let sequence = 0
  let files: readonly QuickOpenFile[] | undefined
  let candidates: QuickOpenCandidate[] = []
  let pending:
    | { cancel: () => void; fallback: () => void; finish: (indices: Uint32Array) => void }
    | undefined

  const failWorker = () => {
    failed = true
    worker?.terminate()
    worker = undefined
    pending?.fallback()
  }
  return {
    rank(
      nextFiles: readonly QuickOpenFile[],
      query: string,
      recentIds: readonly string[],
      signal: AbortSignal,
    ): Promise<QuickOpenFile[]> {
      pending?.cancel()
      if (destroyed || signal.aborted) return Promise.reject(abortError())
      const requestId = ++sequence
      const changed = files !== nextFiles
      if (changed) {
        files = nextFiles
        candidates = createQuickOpenCandidates(nextFiles)
      }
      return new Promise((resolve, reject) => {
        let settled = false
        let fallingBack = false
        const currentCandidates = candidates
        const clear = () => {
          settled = true
          signal.removeEventListener('abort', cancel)
          if (pending === request) pending = undefined
        }
        const cancel = () => {
          if (settled) return
          clear()
          try {
            worker?.postMessage({ type: 'cancel' })
          } catch {
            worker?.terminate()
            worker = undefined
            failed = true
          }
          reject(abortError())
        }
        const finish = (indices: Uint32Array | number[]) => {
          if (settled) return
          clear()
          resolve(Array.from(indices, (index) => nextFiles[index]))
        }
        const fallback = () => {
          if (fallingBack || settled) return
          fallingBack = true
          void runQuickOpenRanking(
            currentCandidates,
            query,
            recentIds,
            () => settled || signal.aborted,
          )
            .then(finish)
            .catch((error: unknown) => {
              if (settled) return
              clear()
              reject(error)
            })
        }
        const request = { cancel, fallback, finish }
        pending = request
        signal.addEventListener('abort', cancel, { once: true })
        try {
          const newWorker = !worker && !failed
          if (newWorker) {
            worker = createWorker()
            worker.onerror = failWorker
            worker.onmessageerror = failWorker
          }
          if (!worker) {
            fallback()
            return
          }
          worker.onmessage = ({ data }: MessageEvent<QuickOpenWorkerResult>) => {
            if (data.requestId !== requestId || pending !== request) return
            if (data.indices) finish(data.indices)
            else failWorker()
          }
          if (changed || newWorker) worker.postMessage({ type: 'files', files: candidates })
          worker.postMessage({ type: 'rank', requestId, query, recentIds })
        } catch {
          failWorker()
        }
      })
    },
    destroy() {
      destroyed = true
      pending?.cancel()
      worker?.terminate()
      worker = undefined
      files = undefined
      candidates = []
    },
  }
}

import {
  runQuickOpenRanking,
  type QuickOpenCandidate,
  type QuickOpenWorkerRequest,
} from './quickOpenRanking'

let files: QuickOpenCandidate[] = []
let generation = 0
self.onmessage = ({ data }: MessageEvent<QuickOpenWorkerRequest>) => {
  const current = ++generation
  if (data.type === 'files') files = data.files
  if (data.type !== 'rank') return
  void runQuickOpenRanking(files, data.query, data.recentIds, () => current !== generation)
    .then((result) => {
      if (current !== generation) return
      const indices = new Uint32Array(result)
      self.postMessage({ requestId: data.requestId, indices }, { transfer: [indices.buffer] })
    })
    .catch((error: unknown) => {
      if (current === generation)
        self.postMessage({ requestId: data.requestId, error: String(error) })
    })
}

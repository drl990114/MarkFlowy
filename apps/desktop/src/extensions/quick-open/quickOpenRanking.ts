import { defaultFilter } from 'cmdk'

export interface QuickOpenFile {
  id: string
  name: string
  path?: string
  relativePath: string
  ext?: string
  fileId?: string
}

export type QuickOpenCandidate = Pick<QuickOpenFile, 'id' | 'name' | 'relativePath' | 'fileId'> & {
  searchPath: string
}

export function createQuickOpenCandidates(files: readonly QuickOpenFile[]): QuickOpenCandidate[] {
  return files.map(({ id, name, relativePath, fileId }) => ({
    id,
    name,
    relativePath,
    searchPath: relativePath.replace(/\\/g, '/'),
    fileId,
  }))
}

/** Cooperative scoring and stable merge sort, shared by the Worker and fallback. */
export function* rankQuickOpenSteps(
  files: readonly QuickOpenCandidate[],
  query: string,
  recentIds: readonly string[],
): Generator<void, number[]> {
  const search = query.trim().replace(/\\/g, '/')
  const recency = new Map(recentIds.map((id, index) => [id, index]))
  const scores = new Float64Array(files.length)
  let ranked: number[] = []
  for (let index = 0; index < files.length; index++) {
    const file = files[index]
    const score = search
      ? Math.max(defaultFilter(file.name, search), defaultFilter(file.searchPath, search) * 0.9)
      : 1
    scores[index] = score
    if (score > 0) ranked.push(index)
    if (index % 128 === 127) yield
  }
  const compare = (a: number, b: number) =>
    scores[b] - scores[a] ||
    (recency.get(files[a].id) ?? recentIds.length) -
      (recency.get(files[b].id) ?? recentIds.length) ||
    Number(Boolean(files[b].fileId)) - Number(Boolean(files[a].fileId)) ||
    files[a].relativePath.localeCompare(files[b].relativePath)
  let scratch = new Array<number>(ranked.length)
  for (let width = 1; width < ranked.length; width *= 2) {
    let operations = 0
    for (let start = 0; start < ranked.length; start += width * 2) {
      const middle = Math.min(start + width, ranked.length)
      const end = Math.min(start + width * 2, ranked.length)
      let left = start
      let right = middle
      for (let index = start; index < end; index++) {
        scratch[index] =
          left < middle && (right >= end || compare(ranked[left], ranked[right]) <= 0)
            ? ranked[left++]
            : ranked[right++]
        if (++operations % 512 === 0) yield
      }
    }
    ;[ranked, scratch] = [scratch, ranked]
  }
  return ranked
}

export function rankQuickOpenFiles(
  files: QuickOpenFile[],
  query: string,
  recentIds: readonly string[] = [],
): QuickOpenFile[] {
  const steps = rankQuickOpenSteps(createQuickOpenCandidates(files), query, recentIds)
  for (;;) {
    const result = steps.next()
    if (result.done) return result.value.map((index) => files[index])
  }
}

export async function runQuickOpenRanking(
  files: readonly QuickOpenCandidate[],
  query: string,
  recentIds: readonly string[],
  isCanceled: () => boolean,
): Promise<number[]> {
  const steps = rankQuickOpenSteps(files, query, recentIds)
  for (;;) {
    // Yield before the first slice, too: popup input and pending state can paint.
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    const deadline = performance.now() + 5
    do {
      if (isCanceled()) throw new DOMException('Search canceled.', 'AbortError')
      const result = steps.next()
      if (result.done) return result.value
    } while (performance.now() < deadline)
  }
}

export type QuickOpenWorkerRequest =
  | { type: 'files'; files: QuickOpenCandidate[] }
  | { type: 'rank'; requestId: number; query: string; recentIds: readonly string[] }
  | { type: 'cancel' }
export interface QuickOpenWorkerResult {
  requestId: number
  indices?: Uint32Array
  error?: string
}

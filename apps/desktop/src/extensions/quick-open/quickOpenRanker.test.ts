import { defaultFilter } from 'cmdk'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createQuickOpenRanker } from './quickOpenRanker'
import {
  createQuickOpenCandidates,
  rankQuickOpenFiles,
  runQuickOpenRanking,
  type QuickOpenFile,
  type QuickOpenWorkerRequest,
  type QuickOpenWorkerResult,
} from './quickOpenRanking'

const files: QuickOpenFile[] = Array.from({ length: 1400 }, (_, n) => ({
  id: String(n),
  name: `${n % 5 ? 'note' : '备忘'}-${n % 20}.md`,
  relativePath: `${n % 3 ? 'docs/' : 'src\\'}${n % 5 ? 'note' : '备忘'}-${n % 20}.md`,
  fileId: n % 7 === 0 ? String(n) : undefined,
}))

class WorkerStub {
  onmessage?: (event: { data: QuickOpenWorkerResult }) => void
  onerror?: () => void
  onmessageerror?: () => void
  messages: QuickOpenWorkerRequest[] = []
  postMessage = vi.fn((message: QuickOpenWorkerRequest) => this.messages.push(message))
  terminate = vi.fn()
  respond(requestId: number, indices: number[]) {
    this.onmessage?.({ data: { requestId, indices: Uint32Array.from(indices) } })
  }
}

afterEach(() => vi.useRealTimers())

describe('Quick Open asynchronous ranking', () => {
  it.each(['md', '备忘', 'src\\note', '', 'note-1.md', '[missing]'])(
    'preserves complete cmdk scoring, stable ties and recency for %s',
    (query) => {
      const recentIds = ['201', '7', '1399']
      const recent = new Map(recentIds.map((id, index) => [id, index]))
      const q = query.trim().replace(/\\/g, '/')
      const reference = files
        .map((file) => ({
          file,
          score: q
            ? Math.max(
                defaultFilter(file.name, q),
                defaultFilter(file.relativePath.replace(/\\/g, '/'), q) * 0.9,
              )
            : 1,
        }))
        .filter(({ score }) => score > 0)
        .sort(
          (a, b) =>
            b.score - a.score ||
            (recent.get(a.file.id) ?? recentIds.length) -
              (recent.get(b.file.id) ?? recentIds.length) ||
            Number(Boolean(b.file.fileId)) - Number(Boolean(a.file.fileId)) ||
            a.file.relativePath.localeCompare(b.file.relativePath),
        )
        .map(({ file }) => file.id)
      expect(rankQuickOpenFiles(files, query, recentIds).map((file) => file.id)).toEqual(reference)
    },
  )

  it('transfers candidates once, cancels obsolete requests and ignores late results', async () => {
    const worker = new WorkerStub()
    const ranker = createQuickOpenRanker(() => worker as unknown as Worker)
    const signal = new AbortController().signal
    const first = ranker.rank(files, 'note', [], signal)
    const rejected = expect(first).rejects.toMatchObject({ name: 'AbortError' })
    const second = ranker.rank(files, '备忘', [], signal)
    await rejected
    expect(worker.messages.filter((message) => message.type === 'files')).toHaveLength(1)
    expect(worker.messages.filter((message) => message.type === 'cancel')).toHaveLength(1)
    const settled = vi.fn()
    void second.then(settled)
    worker.respond(1, [1])
    await Promise.resolve()
    expect(settled).not.toHaveBeenCalled()
    worker.respond(2, [5, 10])
    expect(await second).toEqual([files[5], files[10]])
    ranker.destroy()
    expect(worker.terminate).toHaveBeenCalledOnce()
  })

  it('aborts pending work and terminates its Worker when the popup is disposed', async () => {
    const worker = new WorkerStub()
    const ranker = createQuickOpenRanker(() => worker as unknown as Worker)
    const controller = new AbortController()
    const pending = ranker.rank(files, 'md', [], controller.signal)
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    controller.abort()
    await rejected
    ranker.destroy()
    expect(worker.terminate).toHaveBeenCalledOnce()
    await expect(ranker.rank(files, 'md', [], new AbortController().signal)).rejects.toMatchObject({
      name: 'AbortError',
    })
  })

  it('yields before scoring and falls back cooperatively when Workers fail', async () => {
    vi.useFakeTimers()
    const worker = new WorkerStub()
    const ranker = createQuickOpenRanker(() => worker as unknown as Worker)
    const pending = ranker.rank(files, 'md', ['3'], new AbortController().signal)
    worker.onerror?.()
    const settled = vi.fn()
    void pending.then(settled)
    await Promise.resolve()
    expect(settled).not.toHaveBeenCalled()
    await vi.runAllTimersAsync()
    expect(await pending).toEqual(rankQuickOpenFiles(files, 'md', ['3']))
    expect(worker.terminate).toHaveBeenCalledOnce()
    ranker.destroy()
  })

  it('can cancel the cooperative fallback before any results are published', async () => {
    vi.useFakeTimers()
    let canceled = false
    const pending = runQuickOpenRanking(createQuickOpenCandidates(files), 'md', [], () => canceled)
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    canceled = true
    await vi.runAllTimersAsync()
    await rejected
  })
})

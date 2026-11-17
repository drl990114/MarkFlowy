import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useQuickOpenRanking } from './useQuickOpenRanking'
import type { QuickOpenFile } from './quickOpenRanking'

const pending = vi.hoisted(() => ({
  requests: [] as { signal: AbortSignal; resolve: (files: QuickOpenFile[]) => void }[],
  destroy: vi.fn(),
}))
vi.mock('./quickOpenRanker', () => ({
  QUICK_OPEN_ASYNC_THRESHOLD: 1000,
  createQuickOpenRanker: () => ({
    destroy: pending.destroy,
    rank: (_files: QuickOpenFile[], _query: string, _recent: string[], signal: AbortSignal) =>
      new Promise<QuickOpenFile[]>((resolve) => pending.requests.push({ signal, resolve })),
  }),
}))
afterEach(() => {
  cleanup()
  pending.requests.length = 0
  pending.destroy.mockClear()
})

it('ignores 100 out-of-order ranking completions and releases each mounted ranker', async () => {
  const files = Array.from({ length: 1000 }, (_, index) => ({
    id: `${index}`, name: `note-${index}.md`, relativePath: `note-${index}.md`,
  }))
  const recent: string[] = []
  const { result, rerender, unmount } = renderHook(
    ({ query }) => useQuickOpenRanking(files, query, recent),
    { initialProps: { query: 'note-0' } },
  )
  for (let index = 1; index <= 100; index++) rerender({ query: `note-${index}` })
  expect(pending.requests).toHaveLength(101)
  expect(pending.requests.slice(0, 100).every(({ signal }) => signal.aborted)).toBe(true)
  await act(async () => pending.requests[100].resolve([files[100]]))
  await act(async () => {
    for (let index = 99; index >= 0; index--) pending.requests[index].resolve([files[index]])
  })
  expect(result.current.matches).toEqual([files[100]])
  unmount()
  expect(pending.requests[100].signal.aborted).toBe(true)
  expect(pending.destroy).toHaveBeenCalledOnce()

  for (let index = 0; index < 100; index++) {
    const probe = renderHook(() => useQuickOpenRanking(files, 'note', recent))
    const request = pending.requests.at(-1)!
    probe.unmount()
    expect(request.signal.aborted).toBe(true)
    await act(async () => request.resolve([files[0]]))
  }
  expect(pending.destroy).toHaveBeenCalledTimes(101)
})

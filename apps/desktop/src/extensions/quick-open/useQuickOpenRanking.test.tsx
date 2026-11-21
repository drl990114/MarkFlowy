import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useQuickOpenRanking } from './useQuickOpenRanking'
import type { QuickOpenFile } from './quickOpenRanking'

const ranker = vi.hoisted(() => ({ rank: vi.fn(), destroy: vi.fn() }))
vi.mock('./quickOpenRanker', () => ({
  QUICK_OPEN_ASYNC_THRESHOLD: 1000,
  createQuickOpenRanker: () => ranker,
}))

const files: QuickOpenFile[] = Array.from({ length: 1000 }, (_, index) => ({
  id: String(index), name: `note-${index}.md`, relativePath: `note-${index}.md`,
}))
const recentIds: string[] = []
const environment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }

describe('Quick Open ranking recovery', () => {
  let root: Root
  let container: HTMLDivElement
  let latest: ReturnType<typeof useQuickOpenRanking>
  function Probe({ query = 'note', attempt = 0 }: { query?: string; attempt?: number }) {
    latest = useQuickOpenRanking(files, query, recentIds, attempt)
    return null
  }
  beforeEach(() => {
    environment.IS_REACT_ACT_ENVIRONMENT = true
    vi.resetAllMocks()
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })
  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    delete environment.IS_REACT_ACT_ENVIRONMENT
  })

  it('retries an unchanged failed query and hides the failed result while pending', async () => {
    ranker.rank.mockRejectedValueOnce(new Error('ranking unavailable'))
    await act(async () => root.render(<Probe />))
    expect(latest.failed).toBe(true)
    let resolve!: (matches: QuickOpenFile[]) => void
    ranker.rank.mockImplementationOnce(() => new Promise((done) => { resolve = done }))
    await act(async () => root.render(<Probe attempt={1} />))
    expect(ranker.rank).toHaveBeenCalledTimes(2)
    expect(latest.pending).toBe(true)
    expect(latest.failed).toBe(false)
    expect(latest.matches).toEqual([])
    await act(async () => resolve([files[1]]))
    expect(latest.pending).toBe(false)
    expect(latest.matches).toEqual([files[1]])
  })

  it('aborts a retried request and ignores its result after the query changes', async () => {
    ranker.rank.mockRejectedValueOnce(new Error('ranking unavailable'))
    await act(async () => root.render(<Probe />))
    let resolve!: (matches: QuickOpenFile[]) => void
    ranker.rank.mockImplementationOnce(() => new Promise((done) => { resolve = done }))
    await act(async () => root.render(<Probe attempt={1} />))
    const signal = ranker.rank.mock.calls[1][3] as AbortSignal
    ranker.rank.mockResolvedValueOnce([files[2]])
    await act(async () => root.render(<Probe query='note-2' attempt={1} />))
    expect(signal.aborted).toBe(true)
    await act(async () => resolve([files[1]]))
    expect(latest.matches).toEqual([files[2]])
  })
})

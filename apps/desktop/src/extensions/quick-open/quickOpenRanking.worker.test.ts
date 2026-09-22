import { afterEach, expect, it, vi } from 'vitest'
import { createQuickOpenCandidates, type QuickOpenWorkerRequest } from './quickOpenRanking'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it('the Worker cancels obsolete queries and transfers only the latest result indices', async () => {
  vi.useFakeTimers()
  const scope = {
    onmessage: undefined as ((message: { data: QuickOpenWorkerRequest }) => void) | undefined,
    postMessage: vi.fn(),
  }
  vi.stubGlobal('self', scope)
  await import('./quickOpenRanking.worker')
  const send = (data: QuickOpenWorkerRequest) => scope.onmessage!({ data })
  send({ type: 'files', files: createQuickOpenCandidates([
    { id: 'a', name: 'alpha.md', relativePath: 'alpha.md' },
    { id: 'b', name: 'beta.md', relativePath: 'beta.md' },
  ]) })
  send({ type: 'rank', requestId: 1, query: 'alpha', recentIds: [] })
  send({ type: 'rank', requestId: 2, query: 'beta', recentIds: [] })
  await vi.runAllTimersAsync()
  expect(scope.postMessage).toHaveBeenCalledOnce()
  const [result, options] = scope.postMessage.mock.calls[0]
  expect(result.requestId).toBe(2)
  expect([...result.indices]).toEqual([1])
  expect(options.transfer).toEqual([result.indices.buffer])
  send({ type: 'rank', requestId: 3, query: 'alpha', recentIds: [] })
  send({ type: 'cancel' })
  await vi.runAllTimersAsync()
  expect(scope.postMessage).toHaveBeenCalledOnce()
})

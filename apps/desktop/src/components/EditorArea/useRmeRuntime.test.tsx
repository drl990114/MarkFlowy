import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { RmeRuntime } from './rmeRuntime'
import { useRmeRuntime } from './useRmeRuntime'

const mocks = vi.hoisted(() => ({ load: vi.fn(), loaded: vi.fn() }))
vi.mock('./rmeRuntime', () => ({
  loadRmeRuntime: mocks.load,
  getLoadedRmeRuntime: mocks.loaded,
}))
const runtime = { Editor: () => null } as unknown as RmeRuntime
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

it('loads only for a requested legacy view and keeps the loaded engine for reuse', async () => {
  mocks.load.mockResolvedValue(runtime)
  const view = renderHook(({ required }) => useRmeRuntime(required), {
    initialProps: { required: false },
  })
  expect(mocks.load).not.toHaveBeenCalled()
  view.rerender({ required: true })
  await waitFor(() => expect(view.result.current.runtime).toBe(runtime))
  view.rerender({ required: false })
  view.rerender({ required: true })
  expect(mocks.load).toHaveBeenCalledOnce()
})

it.each(['resolve', 'reject'] as const)(
  'ignores a late %s after leaving the requested view',
  async (completion) => {
    let resolve!: (value: RmeRuntime) => void
    let reject!: (error: Error) => void
    mocks.load.mockReturnValue(
      new Promise<RmeRuntime>((yes, no) => {
        resolve = yes
        reject = no
      }),
    )
    const view = renderHook(({ required }) => useRmeRuntime(required), {
      initialProps: { required: true },
    })
    view.rerender({ required: false })
    await act(async () => {
      if (completion === 'resolve') resolve(runtime)
      else reject(new Error('Late load failure'))
    })
    expect(view.result.current.runtime).toBeUndefined()
    expect(view.result.current.error).toBeUndefined()
    mocks.load.mockResolvedValue(runtime)
    view.rerender({ required: true })
    await waitFor(() => expect(view.result.current.runtime).toBe(runtime))
  },
)

it('retries a failed engine import and clears the error', async () => {
  mocks.load.mockRejectedValueOnce(new Error('Engine unavailable')).mockResolvedValue(runtime)
  const view = renderHook(() => useRmeRuntime(true))
  await waitFor(() => expect(view.result.current.error?.message).toBe('Engine unavailable'))
  act(() => view.result.current.retry())
  await waitFor(() => expect(view.result.current.runtime).toBe(runtime))
  expect(view.result.current.error).toBeUndefined()
  expect(mocks.load).toHaveBeenCalledTimes(2)
})

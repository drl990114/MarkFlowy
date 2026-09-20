import { expect, it, vi } from 'vitest'

const loaded = vi.hoisted(() => vi.fn())
vi.mock('rme', () => {
  loaded()
  return { Editor: () => null }
})

it('defers the engine import and shares pending and completed loads across consumers', async () => {
  const { getLoadedRmeRuntime, loadRmeRuntime } = await import('./rmeRuntime')
  expect(loaded).not.toHaveBeenCalled()
  expect(getLoadedRmeRuntime()).toBeUndefined()
  const first = loadRmeRuntime()
  expect(loadRmeRuntime()).toBe(first)
  const runtime = await first
  expect(loaded).toHaveBeenCalledOnce()
  expect(getLoadedRmeRuntime()).toBe(runtime)
  expect(await loadRmeRuntime()).toBe(runtime)
})

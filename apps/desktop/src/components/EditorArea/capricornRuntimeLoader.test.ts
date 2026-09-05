import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface RuntimeModule {
  createCapricornRuntime: unknown
}

beforeEach(() => {
  vi.resetModules()
  vi.doMock('@/constants/capricornRuntime', () => ({ isCapricornRuntimeAvailable: true }))
})

afterEach(() => {
  vi.doUnmock('virtual:markflowy-capricorn-runtime')
  vi.doUnmock('@/constants/capricornRuntime')
})

describe('Capricorn runtime preloading', () => {
  it('prewarms an optional runtime Worker after the shared module import without creating a session', async () => {
    const createCapricornRuntime = vi.fn()
    const prewarmCapricornRuntime = vi.fn()
    const importRuntime = vi.fn(() => ({ createCapricornRuntime, prewarmCapricornRuntime }))
    vi.doMock('virtual:markflowy-capricorn-runtime', importRuntime)
    const { preloadCapricornRuntimeFactory, loadCapricornRuntimeFactory } = await import(
      './capricornRuntimeAdapter'
    )
    await preloadCapricornRuntimeFactory()
    expect(prewarmCapricornRuntime).toHaveBeenCalledOnce()
    expect(createCapricornRuntime).not.toHaveBeenCalled()
    await expect(loadCapricornRuntimeFactory()).resolves.toBe(createCapricornRuntime)
    expect(importRuntime).toHaveBeenCalledOnce()
    expect(prewarmCapricornRuntime).toHaveBeenCalledOnce()
  })

  it('awaits and shares an asynchronous Worker readiness handshake', async () => {
    const createCapricornRuntime = vi.fn()
    let markReady!: () => void
    const ready = new Promise<void>((resolve) => {
      markReady = resolve
    })
    const prewarmCapricornRuntime = vi.fn(() => ready)
    vi.doMock('virtual:markflowy-capricorn-runtime', () => ({
      createCapricornRuntime,
      prewarmCapricornRuntime,
    }))
    const { preloadCapricornRuntimeFactory } = await import('./capricornRuntimeAdapter')

    const first = preloadCapricornRuntimeFactory()
    const second = preloadCapricornRuntimeFactory()
    let settled = false
    void Promise.all([first, second]).then(() => {
      settled = true
    })
    await vi.waitFor(() => expect(prewarmCapricornRuntime).toHaveBeenCalledOnce())
    expect(settled).toBe(false)
    markReady()
    await expect(Promise.all([first, second])).resolves.toEqual([undefined, undefined])
    expect(prewarmCapricornRuntime).toHaveBeenCalledOnce()

    await expect(preloadCapricornRuntimeFactory()).resolves.toBeUndefined()
    expect(prewarmCapricornRuntime).toHaveBeenCalledTimes(2)
  })

  it('retries an optional Worker readiness handshake after a settled failure', async () => {
    const createCapricornRuntime = vi.fn()
    const prewarmCapricornRuntime = vi
      .fn()
      .mockRejectedValueOnce(new Error('Worker readiness failed'))
      .mockResolvedValueOnce(undefined)
    vi.doMock('virtual:markflowy-capricorn-runtime', () => ({
      createCapricornRuntime,
      prewarmCapricornRuntime,
    }))
    const { preloadCapricornRuntimeFactory } = await import('./capricornRuntimeAdapter')

    await expect(preloadCapricornRuntimeFactory()).resolves.toBeUndefined()
    await expect(preloadCapricornRuntimeFactory()).resolves.toBeUndefined()
    expect(prewarmCapricornRuntime).toHaveBeenCalledTimes(2)
  })

  it('keeps a failed optional Worker prewarm non-fatal for legacy session loading', async () => {
    const createCapricornRuntime = vi.fn()
    vi.doMock('virtual:markflowy-capricorn-runtime', () => ({
      createCapricornRuntime,
      prewarmCapricornRuntime: () => {
        throw new Error('Worker unavailable')
      },
    }))
    const { preloadCapricornRuntimeFactory, loadCapricornRuntimeFactory } = await import(
      './capricornRuntimeAdapter'
    )
    await expect(preloadCapricornRuntimeFactory()).resolves.toBeUndefined()
    await expect(loadCapricornRuntimeFactory()).resolves.toBe(createCapricornRuntime)
    expect(createCapricornRuntime).not.toHaveBeenCalled()
  })

  it('swallows an asynchronous Worker readiness failure', async () => {
    const createCapricornRuntime = vi.fn()
    const prewarmCapricornRuntime = vi.fn(async () => {
      throw new Error('Worker readiness failed')
    })
    vi.doMock('virtual:markflowy-capricorn-runtime', () => ({
      createCapricornRuntime,
      prewarmCapricornRuntime,
    }))
    const { preloadCapricornRuntimeFactory, loadCapricornRuntimeFactory } = await import(
      './capricornRuntimeAdapter'
    )
    await expect(preloadCapricornRuntimeFactory()).resolves.toBeUndefined()
    await expect(loadCapricornRuntimeFactory()).resolves.toBe(createCapricornRuntime)
    expect(prewarmCapricornRuntime).toHaveBeenCalledOnce()
  })

  it('loads the optional async capability from the same cached package module', async () => {
    const createCapricornRuntime = vi.fn()
    const createCapricornRuntimeAsync = vi.fn()
    const importRuntime = vi.fn(() => ({ createCapricornRuntime, createCapricornRuntimeAsync }))
    vi.doMock('virtual:markflowy-capricorn-runtime', importRuntime)
    const { loadCapricornRuntimeFactory, loadCapricornRuntimeAsyncFactory } = await import(
      './capricornRuntimeAdapter'
    )
    await expect(loadCapricornRuntimeAsyncFactory()).resolves.toBe(createCapricornRuntimeAsync)
    await expect(loadCapricornRuntimeFactory()).resolves.toBe(createCapricornRuntime)
    expect(importRuntime).toHaveBeenCalledOnce()
    expect(createCapricornRuntimeAsync).not.toHaveBeenCalled()
  })

  it('keeps old package small-file support but refuses a synchronous large-file fallback', async () => {
    const createCapricornRuntime = vi.fn()
    vi.doMock('virtual:markflowy-capricorn-runtime', () => ({ createCapricornRuntime }))
    const { loadCapricornRuntimeFactory, loadCapricornRuntimeAsyncFactory } = await import(
      './capricornRuntimeAdapter'
    )
    await expect(loadCapricornRuntimeFactory()).resolves.toBe(createCapricornRuntime)
    await expect(loadCapricornRuntimeAsyncFactory()).rejects.toThrow('Upgrade the private runtime')
    expect(createCapricornRuntime).not.toHaveBeenCalled()
  })

  it('skips preloading an unavailable dependency without importing its stub', async () => {
    vi.doMock('@/constants/capricornRuntime', () => ({ isCapricornRuntimeAvailable: false }))
    const importRuntime = vi.fn(() => ({ createCapricornRuntime: vi.fn() }))
    vi.doMock('virtual:markflowy-capricorn-runtime', importRuntime)
    const {
      getLoadedCapricornRuntimeFactory,
      loadCapricornRuntimeFactory,
      preloadCapricornRuntimeFactory,
    } = await import('./capricornRuntimeAdapter')

    await expect(preloadCapricornRuntimeFactory()).resolves.toBeUndefined()
    await expect(preloadCapricornRuntimeFactory()).resolves.toBeUndefined()
    // An explicit mount can still report the failure to its host and fall back.
    await expect(loadCapricornRuntimeFactory()).rejects.toThrow(
      'The Capricorn runtime is not installed or is invalid.',
    )
    expect(getLoadedCapricornRuntimeFactory()).toBeUndefined()
    expect(importRuntime).not.toHaveBeenCalled()
  })

  it('shares startup preloading and concurrent editor loads without creating a session', async () => {
    const createRuntime = vi.fn()
    let resolveModule!: (runtimeModule: RuntimeModule) => void
    const runtimeModule = new Promise<RuntimeModule>((resolve) => {
      resolveModule = resolve
    })
    const importRuntime = vi.fn(() => runtimeModule)
    vi.doMock('virtual:markflowy-capricorn-runtime', importRuntime)
    const {
      getLoadedCapricornRuntimeFactory,
      loadCapricornRuntimeFactory,
      preloadCapricornRuntimeFactory,
    } = await import('./capricornRuntimeAdapter')

    expect(getLoadedCapricornRuntimeFactory()).toBeUndefined()
    expect(importRuntime).not.toHaveBeenCalled()

    const preloading = preloadCapricornRuntimeFactory()
    const loading = loadCapricornRuntimeFactory()
    expect(loadCapricornRuntimeFactory()).toBe(loading)
    await vi.waitFor(() => expect(importRuntime).toHaveBeenCalledOnce())
    expect(getLoadedCapricornRuntimeFactory()).toBeUndefined()
    expect(createRuntime).not.toHaveBeenCalled()

    resolveModule({ createCapricornRuntime: createRuntime })
    await expect(preloading).resolves.toBeUndefined()
    await expect(loading).resolves.toBe(createRuntime)

    expect(getLoadedCapricornRuntimeFactory()).toBe(createRuntime)
    expect(loadCapricornRuntimeFactory()).toBe(loading)
    await expect(preloadCapricornRuntimeFactory()).resolves.toBeUndefined()
    expect(importRuntime).toHaveBeenCalledOnce()
    expect(createRuntime).not.toHaveBeenCalled()
  })

  it('swallows a failed preload and allows a later editor load to retry', async () => {
    const failedImport = vi.fn(async () => {
      throw new Error('Runtime download failed')
    })
    vi.doMock('virtual:markflowy-capricorn-runtime', failedImport)
    const {
      getLoadedCapricornRuntimeFactory,
      loadCapricornRuntimeFactory,
      preloadCapricornRuntimeFactory,
    } = await import('./capricornRuntimeAdapter')

    const preloading = preloadCapricornRuntimeFactory()
    const failedLoading = loadCapricornRuntimeFactory()
    await Promise.all([
      expect(preloading).resolves.toBeUndefined(),
      expect(failedLoading).rejects.toThrow(),
    ])
    expect(failedImport).toHaveBeenCalledOnce()
    expect(getLoadedCapricornRuntimeFactory()).toBeUndefined()

    const createRuntime = vi.fn()
    const recoveredImport = vi.fn(() => ({ createCapricornRuntime: createRuntime }))
    vi.doMock('virtual:markflowy-capricorn-runtime', recoveredImport)
    const retriedLoading = loadCapricornRuntimeFactory()

    expect(retriedLoading).not.toBe(failedLoading)
    await expect(retriedLoading).resolves.toBe(createRuntime)
    expect(recoveredImport).toHaveBeenCalledOnce()
    expect(getLoadedCapricornRuntimeFactory()).toBe(createRuntime)
    expect(loadCapricornRuntimeFactory()).toBe(retriedLoading)
    expect(createRuntime).not.toHaveBeenCalled()
  })

  it('keeps repeated preload failures non-fatal while explicit loads still report errors', async () => {
    const error = new Error('Runtime module cannot be loaded')
    vi.doMock('virtual:markflowy-capricorn-runtime', () => {
      throw error
    })
    const {
      getLoadedCapricornRuntimeFactory,
      loadCapricornRuntimeFactory,
      preloadCapricornRuntimeFactory,
    } = await import('./capricornRuntimeAdapter')

    await expect(preloadCapricornRuntimeFactory()).resolves.toBeUndefined()
    await expect(preloadCapricornRuntimeFactory()).resolves.toBeUndefined()
    await expect(loadCapricornRuntimeFactory()).rejects.toThrow()
    expect(getLoadedCapricornRuntimeFactory()).toBeUndefined()
  })

  it.each([undefined, null, {}, 'not a factory'])(
    'rejects the invalid factory export %j',
    async (exportedFactory) => {
      vi.doMock('virtual:markflowy-capricorn-runtime', () => ({
        createCapricornRuntime: exportedFactory,
      }))
      const { getLoadedCapricornRuntimeFactory, loadCapricornRuntimeFactory } = await import(
        './capricornRuntimeAdapter'
      )

      const invalidLoading = loadCapricornRuntimeFactory()
      await expect(invalidLoading).rejects.toThrow(
        new TypeError('The Capricorn package does not expose createCapricornRuntime.'),
      )
      expect(getLoadedCapricornRuntimeFactory()).toBeUndefined()

      const createRuntime = vi.fn()
      vi.doMock('virtual:markflowy-capricorn-runtime', () => ({
        createCapricornRuntime: createRuntime,
      }))
      const retriedLoading = loadCapricornRuntimeFactory()
      expect(retriedLoading).not.toBe(invalidLoading)
      await expect(retriedLoading).resolves.toBe(createRuntime)
      expect(getLoadedCapricornRuntimeFactory()).toBe(createRuntime)
      expect(createRuntime).not.toHaveBeenCalled()
    },
  )
})

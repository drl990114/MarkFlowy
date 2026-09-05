import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Register once so queued mock overrides cannot race while resolving the same module.
const runtimeAvailability = vi.hoisted(() => ({ isCapricornRuntimeAvailable: true }))
vi.mock('@/constants/capricornRuntime', () => runtimeAvailability)

const deferred = <T>() => {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, reject, resolve }
}

beforeEach(() => {
  vi.resetModules()
  runtimeAvailability.isCapricornRuntimeAvailable = true
})

afterEach(() => {
  vi.useRealTimers()
  vi.doUnmock('virtual:markflowy-capricorn-runtime')
})

describe('app startup editor preparation', () => {
  it('overlaps settings and workspace I/O but awaits both the module and Worker before exposing editors', async () => {
    const createCapricornRuntime = vi.fn()
    const worker = deferred<void>()
    const prewarmCapricornRuntime = vi.fn(() => worker.promise)
    const runtime = deferred<{
      createCapricornRuntime: typeof createCapricornRuntime
      prewarmCapricornRuntime: typeof prewarmCapricornRuntime
    }>()
    const importRuntime = vi.fn(() => runtime.promise)
    vi.doMock('virtual:markflowy-capricorn-runtime', importRuntime)
    const { createAppStartupCoordinator } = await import('./appStartupCoordinator')
    const { getLoadedCapricornRuntimeFactory } = await import(
      '@/components/EditorArea/capricornRuntimeAdapter'
    )
    const shell = deferred<string>()
    const workspace = deferred<string>()
    const loadShell = vi.fn(() => shell.promise)
    const loadWorkspace = vi.fn(() => workspace.promise)
    const coordinator = createAppStartupCoordinator({ loadShell, loadWorkspace })

    const starting = coordinator.start()
    expect(coordinator.start()).toBe(starting)
    expect(loadShell).toHaveBeenCalledOnce()
    await vi.waitFor(() => expect(importRuntime).toHaveBeenCalledOnce())
    expect(coordinator.getSnapshot().shell.status).toBe('loading')

    shell.resolve('settings')
    await vi.waitFor(() => expect(loadWorkspace).toHaveBeenCalledOnce())
    workspace.resolve('workspace')
    expect(coordinator.getSnapshot()).toMatchObject({
      shell: { status: 'ready', data: 'settings' },
      workspace: { status: 'loading' },
    })
    expect(getLoadedCapricornRuntimeFactory()).toBeUndefined()

    runtime.resolve({ createCapricornRuntime, prewarmCapricornRuntime })
    await vi.waitFor(() => expect(prewarmCapricornRuntime).toHaveBeenCalledOnce())
    expect(getLoadedCapricornRuntimeFactory()).toBe(createCapricornRuntime)
    expect(coordinator.getSnapshot().workspace.status).toBe('loading')

    worker.resolve()
    await starting
    expect(coordinator.getSnapshot().workspace).toEqual({ status: 'ready', data: 'workspace' })
    expect(importRuntime).toHaveBeenCalledOnce()
    expect(prewarmCapricornRuntime).toHaveBeenCalledOnce()
    expect(createCapricornRuntime).not.toHaveBeenCalled()
  })

  it('still waits for workspace I/O when editor preparation finishes first', async () => {
    const prewarmCapricornRuntime = vi.fn()
    vi.doMock('virtual:markflowy-capricorn-runtime', () => ({
      createCapricornRuntime: vi.fn(),
      prewarmCapricornRuntime,
    }))
    const { createAppStartupCoordinator } = await import('./appStartupCoordinator')
    const workspace = deferred<string>()
    const coordinator = createAppStartupCoordinator({
      loadShell: async () => 'settings',
      loadWorkspace: () => workspace.promise,
    })

    const starting = coordinator.start()
    await vi.waitFor(() => expect(prewarmCapricornRuntime).toHaveBeenCalledOnce())
    expect(coordinator.getSnapshot().workspace.status).toBe('loading')
    workspace.resolve('workspace')
    await starting
    expect(coordinator.getSnapshot().workspace).toEqual({ status: 'ready', data: 'workspace' })
  })

  it('skips the unavailable optional runtime without importing its stub', async () => {
    runtimeAvailability.isCapricornRuntimeAvailable = false
    const importRuntime = vi.fn(() => ({ createCapricornRuntime: vi.fn() }))
    vi.doMock('virtual:markflowy-capricorn-runtime', importRuntime)
    const { createAppStartupCoordinator } = await import('./appStartupCoordinator')
    const coordinator = createAppStartupCoordinator({
      loadShell: async () => 'settings',
      loadWorkspace: async () => 'workspace',
    })

    await coordinator.start()
    expect(coordinator.getSnapshot().workspace.status).toBe('ready')
    expect(importRuntime).not.toHaveBeenCalled()
  })

  it.each(['module', 'worker'])('continues startup after an optional %s failure', async (stage) => {
    const createCapricornRuntime = vi.fn()
    const prewarmCapricornRuntime = vi.fn().mockRejectedValue(new Error('Worker failed'))
    vi.doMock('virtual:markflowy-capricorn-runtime', () => {
      if (stage === 'module') throw new Error('Module failed')
      return { createCapricornRuntime, prewarmCapricornRuntime }
    })
    const { createAppStartupCoordinator } = await import('./appStartupCoordinator')
    const coordinator = createAppStartupCoordinator({
      loadShell: async () => 'settings',
      loadWorkspace: async () => 'workspace',
    })

    await expect(coordinator.start()).resolves.toBeUndefined()
    expect(coordinator.getSnapshot().workspace.status).toBe('ready')
    expect(createCapricornRuntime).not.toHaveBeenCalled()
  })

  it.each(['module', 'worker'])(
    'bounds a stalled %s and safely accepts late completion',
    async (stage) => {
      const createCapricornRuntime = vi.fn()
      const stalled = deferred<void>()
      const prewarmCapricornRuntime = vi.fn(() =>
        stage === 'worker' ? stalled.promise : undefined,
      )
      vi.doMock('virtual:markflowy-capricorn-runtime', async () => {
        if (stage === 'module') await stalled.promise
        return { createCapricornRuntime, prewarmCapricornRuntime }
      })
      const { CAPRICORN_STARTUP_TIMEOUT_MS, createAppStartupCoordinator } = await import(
        './appStartupCoordinator'
      )
      const { getLoadedCapricornRuntimeFactory } = await import(
        '@/components/EditorArea/capricornRuntimeAdapter'
      )
      vi.useFakeTimers()
      const coordinator = createAppStartupCoordinator({
        loadShell: async () => 'settings',
        loadWorkspace: async () => 'workspace',
      })

      const starting = coordinator.start()
      await vi.advanceTimersByTimeAsync(CAPRICORN_STARTUP_TIMEOUT_MS - 1)
      expect(coordinator.getSnapshot().workspace.status).toBe('loading')
      await vi.advanceTimersByTimeAsync(1)
      await starting
      expect(coordinator.getSnapshot().workspace.status).toBe('ready')
      expect(vi.getTimerCount()).toBe(0)

      stalled.resolve()
      await vi.waitFor(() =>
        expect(getLoadedCapricornRuntimeFactory()).toBe(createCapricornRuntime),
      )
      expect(coordinator.getSnapshot().workspace.status).toBe('ready')
      expect(createCapricornRuntime).not.toHaveBeenCalled()
    },
  )

  it('clears the startup timeout when preparation completes normally', async () => {
    vi.doMock('virtual:markflowy-capricorn-runtime', () => ({ createCapricornRuntime: vi.fn() }))
    const { createAppStartupCoordinator } = await import('./appStartupCoordinator')
    vi.useFakeTimers()
    const coordinator = createAppStartupCoordinator({
      loadShell: async () => 'settings',
      loadWorkspace: async () => 'workspace',
    })

    await coordinator.start()
    expect(coordinator.getSnapshot().workspace.status).toBe('ready')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('keeps workspace recovery behind preparation and retries only failed workspace I/O', async () => {
    const worker = deferred<void>()
    const prewarmCapricornRuntime = vi.fn(() => worker.promise)
    vi.doMock('virtual:markflowy-capricorn-runtime', () => ({
      createCapricornRuntime: vi.fn(),
      prewarmCapricornRuntime,
    }))
    const { createAppStartupCoordinator } = await import('./appStartupCoordinator')
    const loadShell = vi.fn(async () => 'settings')
    const error = new Error('Workspace unavailable')
    const loadWorkspace = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce('workspace')
    const coordinator = createAppStartupCoordinator({ loadShell, loadWorkspace })

    const starting = coordinator.start()
    await vi.waitFor(() => expect(prewarmCapricornRuntime).toHaveBeenCalledOnce())
    expect(coordinator.getSnapshot().workspace.status).toBe('loading')
    expect(coordinator.recoverWorkspace('too early')).toBe(false)

    worker.resolve()
    await starting
    expect(coordinator.getSnapshot().workspace).toEqual({ status: 'error', error })
    await coordinator.retry()
    expect(coordinator.getSnapshot().workspace).toEqual({ status: 'ready', data: 'workspace' })
    expect(loadShell).toHaveBeenCalledOnce()
    expect(loadWorkspace).toHaveBeenCalledTimes(2)
    expect(prewarmCapricornRuntime).toHaveBeenCalledOnce()
  })

  it('does not publish a cancelled workspace when shared preparation finishes', async () => {
    const worker = deferred<void>()
    const prewarmCapricornRuntime = vi.fn(() => worker.promise)
    vi.doMock('virtual:markflowy-capricorn-runtime', () => ({
      createCapricornRuntime: vi.fn(),
      prewarmCapricornRuntime,
    }))
    const { createAppStartupCoordinator } = await import('./appStartupCoordinator')
    const loadWorkspace = vi.fn().mockResolvedValueOnce('obsolete').mockResolvedValueOnce('latest')
    const coordinator = createAppStartupCoordinator({
      loadShell: async () => 'settings',
      loadWorkspace,
    })

    const obsolete = coordinator.start()
    await vi.waitFor(() => expect(loadWorkspace).toHaveBeenCalledOnce())
    coordinator.cancel()
    const latest = coordinator.start()
    await vi.waitFor(() => expect(loadWorkspace).toHaveBeenCalledTimes(2))
    worker.resolve()
    await Promise.all([obsolete, latest])

    expect(coordinator.getSnapshot().workspace).toEqual({ status: 'ready', data: 'latest' })
    expect(prewarmCapricornRuntime).toHaveBeenCalledOnce()
  })
})

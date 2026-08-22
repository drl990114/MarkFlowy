import { describe, expect, it, vi } from 'vitest'
import { createStartupCoordinator, STARTUP_PERFORMANCE_MARKS } from './startupCoordinator'

const deferred = <T>() => {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })

  return { promise, reject, resolve }
}

describe('createStartupCoordinator', () => {
  it('deduplicates StrictMode-style starts and exposes shell before workspace is ready', async () => {
    const shell = deferred<string>()
    const workspace = deferred<number>()
    const loadShell = vi.fn(() => shell.promise)
    const loadWorkspace = vi.fn(() => workspace.promise)
    const coordinator = createStartupCoordinator({ loadShell, loadWorkspace })

    const firstStart = coordinator.start()
    const secondStart = coordinator.start()

    expect(secondStart).toBe(firstStart)
    expect(loadShell).toHaveBeenCalledTimes(1)
    expect(coordinator.getSnapshot().shell.status).toBe('loading')

    shell.resolve('settings')
    await Promise.resolve()

    expect(coordinator.getSnapshot()).toMatchObject({
      shell: { status: 'ready', data: 'settings' },
      workspace: { status: 'loading' },
    })
    expect(loadWorkspace).toHaveBeenCalledTimes(1)

    workspace.resolve(42)
    await firstStart

    expect(coordinator.getSnapshot()).toMatchObject({
      shell: { status: 'ready', data: 'settings' },
      workspace: { status: 'ready', data: 42 },
    })
  })

  it('retries only the workspace after a workspace failure', async () => {
    const loadShell = vi.fn(async () => 'settings')
    const loadWorkspace = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('workspace unavailable'))
      .mockResolvedValueOnce('workspace')
    const coordinator = createStartupCoordinator({ loadShell, loadWorkspace })

    await coordinator.start()
    expect(coordinator.getSnapshot().workspace.status).toBe('error')

    await coordinator.start()
    expect(loadWorkspace).toHaveBeenCalledTimes(1)

    await coordinator.retry()

    expect(loadShell).toHaveBeenCalledTimes(1)
    expect(loadWorkspace).toHaveBeenCalledTimes(2)
    expect(coordinator.getSnapshot().workspace).toEqual({
      status: 'ready',
      data: 'workspace',
    })
  })

  it('accepts an externally completed workspace only from the error state', async () => {
    const coordinator = createStartupCoordinator<string, string>({
      loadShell: async () => 'settings',
      loadWorkspace: async () => {
        throw new Error('workspace unavailable')
      },
    })

    expect(coordinator.recoverWorkspace('too early')).toBe(false)
    await coordinator.start()
    expect(coordinator.recoverWorkspace('replacement workspace')).toBe(true)
    expect(coordinator.getSnapshot().workspace).toEqual({
      status: 'ready',
      data: 'replacement workspace',
    })
    expect(coordinator.recoverWorkspace('duplicate')).toBe(false)
  })

  it('retries the full run after a shell failure', async () => {
    const loadShell = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('settings unavailable'))
      .mockResolvedValueOnce('settings')
    const loadWorkspace = vi.fn(async () => 'workspace')
    const coordinator = createStartupCoordinator({ loadShell, loadWorkspace })

    await coordinator.start()
    expect(coordinator.getSnapshot().shell.status).toBe('error')

    await coordinator.start()
    expect(loadShell).toHaveBeenCalledTimes(1)

    await coordinator.retry()

    expect(loadShell).toHaveBeenCalledTimes(2)
    expect(loadWorkspace).toHaveBeenCalledTimes(1)
    expect(coordinator.getSnapshot()).toMatchObject({
      attempt: 2,
      shell: { status: 'ready' },
      workspace: { status: 'ready' },
    })
  })

  it('cancels state updates from an obsolete run and can start again', async () => {
    const firstShell = deferred<string>()
    const loadShell = vi
      .fn<() => Promise<string>>()
      .mockReturnValueOnce(firstShell.promise)
      .mockResolvedValueOnce('settings')
    const loadWorkspace = vi.fn(async () => 'workspace')
    const coordinator = createStartupCoordinator({ loadShell, loadWorkspace })

    const obsoleteRun = coordinator.start()
    coordinator.cancel()
    firstShell.resolve('obsolete settings')
    await obsoleteRun

    expect(coordinator.getSnapshot().shell.status).toBe('idle')

    await coordinator.start()
    expect(coordinator.getSnapshot()).toMatchObject({
      shell: { status: 'ready', data: 'settings' },
      workspace: { status: 'ready', data: 'workspace' },
    })
  })

  it('publishes stable snapshots and startup performance marks', async () => {
    const mark = vi.spyOn(performance, 'mark')
    const coordinator = createStartupCoordinator({
      loadShell: async () => 'settings',
      loadWorkspace: async () => 'workspace',
    })
    const listener = vi.fn()
    const unsubscribe = coordinator.subscribe(listener)

    await coordinator.start()
    const readySnapshot = coordinator.getSnapshot()
    unsubscribe()
    await coordinator.start()

    expect(coordinator.getSnapshot()).toBe(readySnapshot)
    expect(listener).toHaveBeenCalledTimes(4)
    expect(mark).toHaveBeenCalledWith(STARTUP_PERFORMANCE_MARKS.reactStart)
    expect(mark).toHaveBeenCalledWith(STARTUP_PERFORMANCE_MARKS.shellDataReady)
    expect(mark).toHaveBeenCalledWith(STARTUP_PERFORMANCE_MARKS.workspaceReady)

    mark.mockRestore()
  })
})

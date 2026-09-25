import { describe, expect, it, vi } from 'vitest'
import { createWorkspaceInputReader } from './workspaceInputs'
import { createStartupCoordinator } from './startupCoordinator'

describe('overlapping startup inputs', () => {
  it('starts session I/O during settings and hands the same result to workspace setup', async () => {
    let settingsReady!: () => void
    const settings = new Promise<void>((resolve) => { settingsReady = resolve })
    const session = { path: '/workspace' }
    const read = vi.fn(async () => session)
    const inputs = createWorkspaceInputReader(read)
    const apply = vi.fn()
    const coordinator = createStartupCoordinator({
      loadShell: async (signal) => {
        void inputs(signal)
        await settings
      },
      loadWorkspace: async (_, signal) => { apply(await inputs(signal)) },
    })
    const started = coordinator.start()
    await Promise.resolve()
    expect(read).toHaveBeenCalledOnce()
    expect(apply).not.toHaveBeenCalled()
    settingsReady()
    await started
    expect(read).toHaveBeenCalledOnce()
    expect(apply).toHaveBeenCalledExactlyOnceWith(session)
  })

  it('surfaces read failures at workspace setup and reads fresh inputs on retry', async () => {
    const read = vi.fn().mockRejectedValueOnce(new Error('cache unavailable')).mockResolvedValue('new')
    const inputs = createWorkspaceInputReader(read)
    const coordinator = createStartupCoordinator({
      loadShell: async (signal) => { void inputs(signal) },
      loadWorkspace: (_, signal) => inputs(signal),
    })
    await coordinator.start()
    expect(coordinator.getSnapshot().workspace.status).toBe('error')
    await coordinator.retry()
    expect(coordinator.getSnapshot().workspace).toEqual({ status: 'ready', data: 'new' })
    expect(read).toHaveBeenCalledTimes(2)
  })

  it('does not start I/O for an already canceled attempt or reuse it in a new one', async () => {
    const read = vi.fn(async () => 'fresh')
    const inputs = createWorkspaceInputReader(read)
    const canceled = new AbortController()
    canceled.abort()
    await expect(inputs(canceled.signal)).rejects.toThrow()
    expect(read).not.toHaveBeenCalled()
    await expect(inputs(new AbortController().signal)).resolves.toBe('fresh')
  })
})

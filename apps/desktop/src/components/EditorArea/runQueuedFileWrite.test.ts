import { describe, expect, it, vi } from 'vitest'
import { runQueuedFileWrite } from './runQueuedFileWrite'
import { SavePathCoordinator } from './savePathCoordinator'

describe('runQueuedFileWrite', () => {
  it('waits for a rename mutation and then writes the latest path', async () => {
    const coordinator = new SavePathCoordinator()
    let releaseRename: (() => void) | undefined
    const renameCanFinish = new Promise<void>((resolve) => {
      releaseRename = resolve
    })
    let currentPath = '/notes/old.md'
    const rename = coordinator.runFileMutation(async () => {
      await renameCanFinish
      currentPath = '/notes/new.md'
    })
    const write = vi.fn(async () => undefined)

    const save = runQueuedFileWrite({
      coordinator,
      getCurrentPath: () => currentPath,
      write,
    })

    await Promise.resolve()
    expect(write).not.toHaveBeenCalled()

    releaseRename?.()
    await rename
    await expect(save).resolves.toEqual({ status: 'written', value: undefined })
    expect(write).toHaveBeenCalledOnce()
    expect(write).toHaveBeenCalledWith('/notes/new.md')
  })

  it('does not write when the file no longer has a path', async () => {
    const write = vi.fn(async () => undefined)

    await expect(
      runQueuedFileWrite({
        coordinator: new SavePathCoordinator(),
        getCurrentPath: () => undefined,
        write,
      }),
    ).resolves.toEqual({ status: 'missing-path' })
    expect(write).not.toHaveBeenCalled()
  })
})

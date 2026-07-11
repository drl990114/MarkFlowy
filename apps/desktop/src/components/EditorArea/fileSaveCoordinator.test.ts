import { describe, expect, it, vi } from 'vitest'
import { FileSaveCoordinator } from './fileSaveCoordinator'

describe('FileSaveCoordinator', () => {
  it('retains the loaded disk revision until the file lifecycle is released', async () => {
    const coordinator = new FileSaveCoordinator()
    coordinator.setDiskRevision('file', 'disk:loaded')

    expect(coordinator.getDiskRevision('file')).toBe('disk:loaded')

    await coordinator.releaseWhenIdle('file', () => true, () => undefined)
    expect(coordinator.getDiskRevision('file')).toBeUndefined()
  })

  it('serializes saves for the same file', async () => {
    const coordinator = new FileSaveCoordinator()
    coordinator.recordContent('file', 'first')
    let finishFirst: (() => void) | undefined
    const events: string[] = []

    const first = coordinator.saveLatest('file', async ({ content }) => {
      events.push(`first:start:${content}`)
      await new Promise<void>((resolve) => {
        finishFirst = resolve
      })
      events.push('first:end')
      return true
    })
    const second = coordinator.saveLatest('file', async ({ content }) => {
      events.push(`second:${content}`)
      return true
    })

    await Promise.resolve()
    expect(events).toEqual(['first:start:first'])

    finishFirst?.()
    await expect(Promise.all([first, second])).resolves.toEqual([true, true])
    expect(events).toEqual(['first:start:first', 'first:end', 'second:first'])
  })

  it('retries with current content when an edit happens during a write', async () => {
    const coordinator = new FileSaveCoordinator()
    coordinator.recordContent('file', 'old')
    let finishOldWrite: (() => void) | undefined
    const written: Array<string | undefined> = []
    const onLatestSaved = vi.fn()

    const save = coordinator.saveLatest(
      'file',
      async ({ content }) => {
        written.push(content)
        if (content === 'old') {
          await new Promise<void>((resolve) => {
            finishOldWrite = resolve
          })
        }
        return true
      },
      onLatestSaved,
    )

    await Promise.resolve()
    coordinator.recordContent('file', 'new')
    finishOldWrite?.()

    await expect(save).resolves.toBe(true)
    expect(written).toEqual(['old', 'new'])
    expect(onLatestSaved).toHaveBeenCalledOnce()
    expect(onLatestSaved.mock.calls[0][0]).toMatchObject({ content: 'new', revision: 2 })
  })

  it('keeps later saves usable after a canceled or failed save', async () => {
    const coordinator = new FileSaveCoordinator()
    coordinator.recordContent('file', 'content')

    await expect(coordinator.saveLatest('file', async () => false)).resolves.toBe(false)
    await expect(
      coordinator.saveLatest('file', async () => {
        throw new Error('failed')
      }),
    ).rejects.toThrow('failed')
    await expect(coordinator.saveLatest('file', async () => true)).resolves.toBe(true)
  })

  it('releases content only after every queued save is idle', async () => {
    const coordinator = new FileSaveCoordinator()
    coordinator.recordContent('file', 'content')
    let finishWrite: (() => void) | undefined
    const cleanup = vi.fn()

    const save = coordinator.saveLatest('file', async () => {
      await new Promise<void>((resolve) => {
        finishWrite = resolve
      })
      return true
    })
    const release = coordinator.releaseWhenIdle('file', () => true, cleanup)

    await Promise.resolve()
    expect(cleanup).not.toHaveBeenCalled()

    finishWrite?.()
    await expect(save).resolves.toBe(true)
    await expect(release).resolves.toBe(true)
    expect(cleanup).toHaveBeenCalledOnce()
    expect(coordinator.getRevision('file')).toBe(0)
  })

  it('keeps state when the file remounts before its save becomes idle', async () => {
    const coordinator = new FileSaveCoordinator()
    coordinator.recordContent('file', 'content')
    let finishWrite: (() => void) | undefined
    let mounted = false
    const cleanup = vi.fn()

    const save = coordinator.saveLatest('file', async () => {
      await new Promise<void>((resolve) => {
        finishWrite = resolve
      })
      return true
    })
    const release = coordinator.releaseWhenIdle('file', () => !mounted, cleanup)

    await Promise.resolve()
    mounted = true
    finishWrite?.()
    await save

    await expect(release).resolves.toBe(false)
    expect(cleanup).not.toHaveBeenCalled()
    expect(coordinator.getRevision('file')).toBe(1)
  })

  it('advances revision without a cache entry and rebuilds cache from the stable snapshot', async () => {
    const coordinator = new FileSaveCoordinator()
    let cachedContent: string | undefined
    let finishFirstWrite: (() => void) | undefined
    const written: Array<string | undefined> = []

    coordinator.recordContent('file', 'old')
    const save = coordinator.saveLatest(
      'file',
      async ({ content }) => {
        written.push(content)
        if (content === 'old') {
          await new Promise<void>((resolve) => {
            finishFirstWrite = resolve
          })
        }
        return true
      },
      ({ content }) => {
        cachedContent = content
      },
    )

    await Promise.resolve()
    coordinator.recordContent('file', 'new-without-cache')
    finishFirstWrite?.()
    await save

    expect(written).toEqual(['old', 'new-without-cache'])
    expect(cachedContent).toBe('new-without-cache')
  })
})

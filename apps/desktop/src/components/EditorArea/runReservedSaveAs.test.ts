import { describe, expect, it, vi } from 'vitest'
import { runReservedSaveAs } from './runReservedSaveAs'
import { SavePathCoordinator } from './savePathCoordinator'

const applyImmediately = (update: () => void) => update()
const collisions = (ids: string[]) => ({ protectedIds: ids, replaceIds: ids })

describe('runReservedSaveAs', () => {
  it('replaces a clean open target instead of blocking it', async () => {
    const coordinator = new SavePathCoordinator()
    const closeAndReplace = vi.fn()
    let reservedDuringWrite = false

    await expect(
      runReservedSaveAs({
        applyReservationUpdate: applyImmediately,
        collectCollisions: () => collisions(['clean-open-target']),
        collectPostWriteReplaceIds: () => [],
        coordinator,
        isDirty: () => false,
        ownerFileId: 'source',
        path: '/workspace/target.md',
        replaceCollisions: closeAndReplace,
        write: async () => {
          reservedDuringWrite = coordinator.isFileReserved(
            'clean-open-target',
            '/workspace/Target.md',
          )
          return true
        },
      }),
    ).resolves.toBe(true)

    expect(closeAndReplace).toHaveBeenCalledWith(['clean-open-target'])
    expect(reservedDuringWrite).toBe(true)
    expect(coordinator.isFileReserved('clean-open-target', '/workspace/Target.md')).toBe(false)
  })

  it('serializes concurrent Save As operations targeting the same path', async () => {
    const coordinator = new SavePathCoordinator()
    let currentTarget = 'old-target'
    let finishFirstWrite: (() => void) | undefined
    const events: string[] = []

    const save = (sourceId: string, wait: boolean) =>
      runReservedSaveAs({
        applyReservationUpdate: applyImmediately,
        collectCollisions: () => collisions(currentTarget === sourceId ? [] : [currentTarget]),
        collectPostWriteReplaceIds: () => [],
        coordinator,
        isDirty: () => false,
        ownerFileId: sourceId,
        path: sourceId === 'source-1' ? '/workspace/target.md' : '/WORKSPACE/TARGET.md',
        replaceCollisions: () => {
          currentTarget = sourceId
          events.push(`${sourceId}:replace`)
        },
        write: async () => {
          events.push(`${sourceId}:write:start`)
          if (wait) {
            await new Promise<void>((resolve) => {
              finishFirstWrite = resolve
            })
          }
          events.push(`${sourceId}:write:end`)
          return true
        },
      })

    const first = save('source-1', true)
    const second = save('source-2', false)
    await vi.waitFor(() => {
      expect(events).toEqual(['source-1:write:start'])
    })
    finishFirstWrite?.()

    await expect(Promise.all([first, second])).resolves.toEqual([true, true])
    expect(events).toEqual([
      'source-1:write:start',
      'source-1:write:end',
      'source-1:replace',
      'source-2:write:start',
      'source-2:write:end',
      'source-2:replace',
    ])
    expect(currentTarget).toBe('source-2')
  })

  it('also removes a new target id that appears while writing', async () => {
    const coordinator = new SavePathCoordinator()
    const collisionIds = ['old-target']
    const replaceCollisions = vi.fn()
    let newTargetBecameDirty = false

    await expect(
      runReservedSaveAs({
        applyReservationUpdate: applyImmediately,
        collectCollisions: () => collisions([...collisionIds]),
        collectPostWriteReplaceIds: () => [...collisionIds],
        coordinator,
        isDirty: () => false,
        ownerFileId: 'source',
        path: '/workspace/target.md',
        replaceCollisions,
        write: async () => {
          collisionIds.push('new-target-during-write')
          if (!coordinator.isFileReserved('new-target-during-write', '/workspace/Foo.md')) {
            newTargetBecameDirty = true
          }
          return true
        },
      }),
    ).resolves.toBe(true)

    expect(replaceCollisions).toHaveBeenCalledWith(['old-target', 'new-target-during-write'])
    expect(newTargetBecameDirty).toBe(false)
  })

  it('blocks a dirty target before starting the durable write', async () => {
    const coordinator = new SavePathCoordinator()
    const write = vi.fn(async () => true)

    await expect(
      runReservedSaveAs({
        applyReservationUpdate: applyImmediately,
        collectCollisions: () => collisions(['dirty-target']),
        collectPostWriteReplaceIds: () => [],
        coordinator,
        isDirty: () => true,
        ownerFileId: 'source',
        path: '/workspace/target.md',
        replaceCollisions: vi.fn(),
        write,
      }),
    ).resolves.toBe(false)

    expect(write).not.toHaveBeenCalled()
  })

  it('protects a hardlink without deleting its distinct directory entry', async () => {
    const coordinator = new SavePathCoordinator()
    const replaceCollisions = vi.fn()
    const syncProtectedAliases = vi.fn()

    await expect(
      runReservedSaveAs({
        applyReservationUpdate: applyImmediately,
        collectCollisions: () => ({ protectedIds: ['hardlink'], replaceIds: [] }),
        collectPostWriteReplaceIds: () => [],
        coordinator,
        isDirty: () => false,
        ownerFileId: 'source',
        path: '/workspace/target.md',
        replaceCollisions,
        syncProtectedAliases,
        write: async () => true,
      }),
    ).resolves.toBe(true)

    expect(replaceCollisions).toHaveBeenCalledWith([])
    expect(syncProtectedAliases).toHaveBeenCalledWith(['hardlink'])
  })

  it('does not overwrite an alias editor that becomes dirty while writing', async () => {
    const coordinator = new SavePathCoordinator()
    const dirtyIds = new Set<string>()
    const syncProtectedAliases = vi.fn()

    await expect(
      runReservedSaveAs({
        applyReservationUpdate: applyImmediately,
        collectCollisions: () => ({ protectedIds: ['hardlink'], replaceIds: [] }),
        collectPostWriteReplaceIds: () => [],
        coordinator,
        isDirty: (fileId) => dirtyIds.has(fileId),
        ownerFileId: 'source',
        path: '/workspace/target.md',
        replaceCollisions: vi.fn(),
        syncProtectedAliases,
        write: async () => {
          dirtyIds.add('hardlink')
          return true
        },
      }),
    ).resolves.toBe(true)

    expect(syncProtectedAliases).toHaveBeenCalledWith([])
  })

  it('never deletes a collision that unexpectedly becomes dirty during writing', async () => {
    const coordinator = new SavePathCoordinator()
    const dirtyIds = new Set<string>()
    const onUnexpectedDirty = vi.fn()
    const replaceCollisions = vi.fn()

    await expect(
      runReservedSaveAs({
        applyReservationUpdate: applyImmediately,
        collectCollisions: () => collisions(['old-target']),
        collectPostWriteReplaceIds: () => ['old-target', 'new-dirty-target'],
        coordinator,
        isDirty: (fileId) => dirtyIds.has(fileId),
        onUnexpectedDirty,
        ownerFileId: 'source',
        path: '/workspace/target.md',
        replaceCollisions,
        write: async () => {
          dirtyIds.add('new-dirty-target')
          return true
        },
      }),
    ).resolves.toBe(false)

    expect(onUnexpectedDirty).toHaveBeenCalledWith(['new-dirty-target'])
    expect(replaceCollisions).not.toHaveBeenCalled()
  })
})

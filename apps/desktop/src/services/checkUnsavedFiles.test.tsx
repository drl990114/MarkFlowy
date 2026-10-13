import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  confirm: vi.fn(),
  getFileObject: vi.fn(),
  getSaveOpenedEditorEntries: vi.fn(),
  idStateMap: new Map<string, { hasUnsavedChanges?: boolean }>(),
  protectDiscard: vi.fn(),
}))

vi.mock('@/helper/files', () => ({
  getFileObject: mocks.getFileObject,
  getSaveOpenedEditorEntries: mocks.getSaveOpenedEditorEntries,
}))

vi.mock('@/services/dialog', () => ({
  dialog: { confirm: mocks.confirm },
}))

vi.mock('@/stores', () => ({
  useEditorStateStore: {
    getState: () => ({ idStateMap: mocks.idStateMap }),
  },
}))

vi.mock('@/i18n', () => ({
  t: (key: string) => key,
}))
vi.mock('./local-history', () => ({ protectDiscard: mocks.protectDiscard }))

import { checkUnsavedFiles, guardUnsavedFilesAsync } from './checkUnsavedFiles'
import { isDraftRecoveryPending, registerDraftRecovery } from './draftRecoveryState'

describe('guardUnsavedFilesAsync', () => {
  it('waits for pending disk validation before deciding whether closing requires confirmation', async () => {
    mocks.idStateMap.set('recovering', { hasUnsavedChanges: true })
    const promote = vi.fn()
    const ready = registerDraftRecovery('recovering', promote)
    const onContinue = vi.fn()
    try {
      const guarded = guardUnsavedFilesAsync({ fileIds: ['recovering'], onContinue })
      expect(promote).toHaveBeenCalledWith('foreground')
      expect(mocks.confirm).not.toHaveBeenCalled()
      expect(onContinue).not.toHaveBeenCalled()
      mocks.idStateMap.set('recovering', { hasUnsavedChanges: false })
      ready()
      await expect(guarded).resolves.toBe(true)
      expect(onContinue).toHaveBeenCalledOnce()
      expect(mocks.confirm).not.toHaveBeenCalled()
    } finally { ready() }
  })

  beforeEach(() => {
    mocks.confirm.mockReset()
    mocks.getFileObject.mockReset()
    mocks.getSaveOpenedEditorEntries.mockReset()
    mocks.idStateMap.clear()
    mocks.protectDiscard.mockReset().mockResolvedValue(undefined)
  })

  it('retries failed recovery before confirming unsaved content', async () => {
    const recover = vi.fn().mockRejectedValueOnce(new Error('history_draft_changed')).mockImplementation(async () => release())
    const release = registerDraftRecovery('retry', recover)
    const onContinue = vi.fn()
    mocks.idStateMap.set('retry', { hasUnsavedChanges: true })
    mocks.confirm.mockResolvedValueOnce('retry').mockResolvedValueOnce('unsaved')
    try {
      await expect(guardUnsavedFilesAsync({ fileIds: ['retry'], onContinue })).resolves.toBe(true)
      expect(recover).toHaveBeenCalledTimes(2)
      expect(mocks.confirm.mock.calls.map(([options]) => options.title)).toEqual(['drafts.restore_failed', 'confirm.close.title'])
      expect(mocks.protectDiscard).toHaveBeenCalledWith(['retry'])
      expect(onContinue).toHaveBeenCalledOnce()
    } finally { release() }
  })

  it('continues after keeping a failed draft without checkpointing its placeholder', async () => {
    const keep = vi.fn(async () => {
      mocks.idStateMap.delete('failed')
      release()
    })
    const release = registerDraftRecovery('failed', async () => { throw new Error('history_corrupt') }, undefined, keep)
    const onContinue = vi.fn()
    mocks.idStateMap.set('failed', { hasUnsavedChanges: true })
    mocks.confirm.mockResolvedValue('keep')
    try {
      await expect(guardUnsavedFilesAsync({ fileIds: ['failed'], onContinue })).resolves.toBe(true)
      expect(keep).toHaveBeenCalledOnce()
      expect(mocks.protectDiscard).not.toHaveBeenCalled()
      expect(mocks.getSaveOpenedEditorEntries).not.toHaveBeenCalled()
      expect(onContinue).toHaveBeenCalledOnce()
    } finally { release() }
  })

  it('still protects other edited documents after keeping a failed recovery', async () => {
    const release = registerDraftRecovery('failed', async () => { throw new Error('history_corrupt') }, undefined, async () => {
      mocks.idStateMap.delete('failed')
      release()
    })
    mocks.idStateMap.set('failed', { hasUnsavedChanges: true })
    mocks.idStateMap.set('edited', { hasUnsavedChanges: true })
    mocks.confirm.mockResolvedValueOnce('keep').mockResolvedValueOnce('cancel')
    const onContinue = vi.fn()
    try {
      await expect(guardUnsavedFilesAsync({ fileIds: ['failed', 'edited'], onContinue })).resolves.toBe(false)
      expect(mocks.confirm).toHaveBeenCalledTimes(2)
      expect(mocks.idStateMap.get('edited')?.hasUnsavedChanges).toBe(true)
      expect(onContinue).not.toHaveBeenCalled()
    } finally { release() }
  })

  it('cancels a failed recovery without releasing its gate or continuing', async () => {
    const keep = vi.fn()
    const release = registerDraftRecovery('failed', async () => { throw new Error('history_corrupt') }, undefined, keep)
    mocks.confirm.mockResolvedValue('cancel')
    const onContinue = vi.fn()
    try {
      await expect(guardUnsavedFilesAsync({ fileIds: ['failed'], onContinue })).resolves.toBe(false)
      expect(isDraftRecoveryPending('failed')).toBe(true)
      expect(keep).not.toHaveBeenCalled()
      expect(onContinue).not.toHaveBeenCalled()
    } finally { release() }
  })

  it('blocks synchronous tab close while recovery is pending even before dirtiness is published', async () => {
    const release = registerDraftRecovery('pending', async () => { throw new Error('history_corrupt') }, undefined, async () => release())
    mocks.confirm.mockResolvedValue('keep')
    const onUnsavedAndClose = vi.fn()
    try {
      expect(checkUnsavedFiles({ fileIds: ['pending'], onUnsavedAndClose })).toBe(1)
      expect(onUnsavedAndClose).not.toHaveBeenCalled()
      await vi.waitFor(() => expect(onUnsavedAndClose).toHaveBeenCalledOnce())
    } finally { release() }
  })

  it('continues immediately when every file is saved', async () => {
    const onContinue = vi.fn()

    await expect(guardUnsavedFilesAsync({ fileIds: ['saved'], onContinue })).resolves.toBe(true)

    expect(onContinue).toHaveBeenCalledOnce()
    expect(mocks.confirm).not.toHaveBeenCalled()
  })

  it('returns false without continuing when the user cancels', async () => {
    mocks.idStateMap.set('dirty', { hasUnsavedChanges: true })
    mocks.confirm.mockResolvedValue('cancel')
    const onContinue = vi.fn()

    await expect(guardUnsavedFilesAsync({ fileIds: ['dirty'], onContinue })).resolves.toBe(false)

    expect(onContinue).not.toHaveBeenCalled()
  })

  it('waits for saves before continuing', async () => {
    mocks.idStateMap.set('dirty', { hasUnsavedChanges: true })
    mocks.confirm.mockResolvedValue('save')
    const save = vi.fn().mockResolvedValue(true)
    const onContinue = vi.fn()
    mocks.getSaveOpenedEditorEntries.mockReturnValue(save)

    await expect(guardUnsavedFilesAsync({ fileIds: ['dirty'], onContinue })).resolves.toBe(true)

    expect(save).toHaveBeenCalledOnce()
    expect(onContinue).toHaveBeenCalledOnce()
    expect(save.mock.invocationCallOrder[0]).toBeLessThan(onContinue.mock.invocationCallOrder[0])
  })

  it('does not continue when any save is canceled or fails', async () => {
    mocks.idStateMap.set('first', { hasUnsavedChanges: true })
    mocks.idStateMap.set('second', { hasUnsavedChanges: true })
    mocks.confirm.mockResolvedValue('save')
    const firstSave = vi.fn().mockResolvedValue(true)
    const secondSave = vi.fn().mockResolvedValue(false)
    const onContinue = vi.fn()
    mocks.getSaveOpenedEditorEntries.mockImplementation((id: string) =>
      id === 'first' ? firstSave : secondSave,
    )

    await expect(
      guardUnsavedFilesAsync({ fileIds: ['first', 'second'], onContinue }),
    ).resolves.toBe(false)

    expect(firstSave).toHaveBeenCalledOnce()
    expect(secondSave).toHaveBeenCalledOnce()
    expect(onContinue).not.toHaveBeenCalled()
  })

  it('does not continue when an unsaved editor has no save handler', async () => {
    mocks.idStateMap.set('dirty', { hasUnsavedChanges: true })
    mocks.confirm.mockResolvedValue('save')
    mocks.getSaveOpenedEditorEntries.mockReturnValue(undefined)
    const onContinue = vi.fn()

    await expect(guardUnsavedFilesAsync({ fileIds: ['dirty'], onContinue })).resolves.toBe(false)

    expect(onContinue).not.toHaveBeenCalled()
  })
})

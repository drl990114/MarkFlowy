import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  confirm: vi.fn(),
  getFileObject: vi.fn(),
  getSaveOpenedEditorEntries: vi.fn(),
  idStateMap: new Map<string, { hasUnsavedChanges?: boolean }>(),
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

import { guardUnsavedFilesAsync } from './checkUnsavedFiles'

describe('guardUnsavedFilesAsync', () => {
  beforeEach(() => {
    mocks.confirm.mockReset()
    mocks.getFileObject.mockReset()
    mocks.getSaveOpenedEditorEntries.mockReset()
    mocks.idStateMap.clear()
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

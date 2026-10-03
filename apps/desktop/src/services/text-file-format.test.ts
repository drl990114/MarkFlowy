import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fileSaveCoordinator } from '@/components/EditorArea/fileSaveCoordinator'
import { DEFAULT_TEXT_METADATA } from '@/components/EditorArea/textFileFormat'
import { applyEncodingPreview, previewFileEncoding, saveFileWithFormat } from './text-file-format'

const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  diskRevision: vi.fn(),
  apply: vi.fn(),
  history: vi.fn(),
  document: vi.fn(),
  save: vi.fn(),
  dirty: vi.fn(),
  content: 'current draft',
  path: '/note.md',
}))
vi.mock('@/helper/files', () => ({
  getFileObject: () => ({ id: 'f', path: mocks.path }),
  getSaveOpenedEditorEntries: () => mocks.save,
}))
vi.mock('@/stores/useEditorStore', () => ({
  default: { getState: () => ({ opened: ['f'], getEditorContent: () => mocks.content }) },
}))
vi.mock('@/stores/useEditorStateStore', () => ({
  default: { getState: () => ({ setIdStateMap: mocks.dirty }) },
}))
vi.mock('@/components/EditorArea/fileSnapshot', () => ({ readStableFileSnapshot: mocks.read }))
vi.mock('@/components/EditorArea/conditionalFileWrite', () => ({
  getFileWriteRevision: mocks.diskRevision,
}))
vi.mock('@/components/EditorArea/externalFileChanges', () => ({
  applyExternalSnapshot: mocks.apply,
}))
vi.mock('./local-history', () => ({
  historyCall: mocks.history,
  historyDocument: mocks.document,
  historyDraftIdentity: () => ({ writer: 'main:f', sequence: 4 }),
  historyFileSaved: vi.fn(),
  protectLocalEdit: vi.fn(),
  flushDraftProtection: vi.fn(),
}))

beforeEach(async () => {
  vi.clearAllMocks()
  mocks.content = 'current draft'
  mocks.path = '/note.md'
  await fileSaveCoordinator.releaseWhenIdle(
    'f',
    () => true,
    () => {},
  )
  fileSaveCoordinator.loadSnapshot('f', {
    status: 'success',
    content: mocks.content,
    revision: 'old',
    text: DEFAULT_TEXT_METADATA,
  })
  mocks.read.mockResolvedValue({
    status: 'success',
    content: '重新解码',
    revision: 'disk',
    text: { ...DEFAULT_TEXT_METADATA, format: { encoding: 'gbk', bom: 'none' } },
  })
  mocks.diskRevision.mockResolvedValue('disk')
  mocks.history.mockResolvedValue({ persisted: true })
  mocks.document.mockResolvedValue({ id: 'document' })
  mocks.save.mockResolvedValue(true)
})

describe('encoding actions', () => {
  it('previews without writing and protects the displaced draft before applying', async () => {
    const preview = await previewFileEncoding('f', 'gbk')
    expect(mocks.read).toHaveBeenCalledWith('/note.md', { encoding: 'gbk' })
    expect(mocks.apply).not.toHaveBeenCalled()
    expect(mocks.save).not.toHaveBeenCalled()
    await applyEncodingPreview(preview)
    expect(mocks.history).toHaveBeenCalledWith(
      'draft',
      expect.objectContaining({
        writer: 'before-encoding:main:f:4',
        content: 'current draft',
        paused: true,
        format: { encoding: 'utf-8', bom: 'none' },
      }),
    )
    expect(mocks.apply).toHaveBeenCalledWith('f', preview.snapshot, 'reloaded')
  })

  it('rejects a stale preview after a format-only edit', async () => {
    const preview = await previewFileEncoding('f', 'gbk')
    fileSaveCoordinator.recordFormat('f', { encoding: 'utf-8', bom: 'utf8' })
    await expect(applyEncodingPreview(preview)).rejects.toThrow('文档已变化')
    expect(mocks.apply).not.toHaveBeenCalled()
  })

  it('retains current content if the disk changes or protection fails', async () => {
    const preview = await previewFileEncoding('f', 'gbk')
    mocks.diskRevision.mockResolvedValue('newer')
    await expect(applyEncodingPreview(preview)).rejects.toThrow('磁盘文件已变化')
    expect(mocks.apply).not.toHaveBeenCalled()
    mocks.diskRevision.mockResolvedValue('disk')
    mocks.history.mockRejectedValue(new Error('disk full'))
    await expect(applyEncodingPreview(preview)).rejects.toThrow('disk full')
    expect(mocks.apply).not.toHaveBeenCalled()
  })

  it('pairs the displaced content with its original format when a newer edit arrives during protection', async () => {
    const preview = await previewFileEncoding('f', 'gbk')
    mocks.document.mockImplementation(async () => {
      fileSaveCoordinator.recordFormat('f', { encoding: 'utf-8', bom: 'utf8' })
      fileSaveCoordinator.setDiskRevision('f', 'newer')
      return { id: 'document' }
    })
    await expect(applyEncodingPreview(preview)).rejects.toThrow('文档或磁盘文件已变化')
    expect(mocks.history).toHaveBeenCalledWith(
      'draft',
      expect.objectContaining({
        content: 'current draft',
        format: { encoding: 'utf-8', bom: 'none' },
        diskRevision: 'old',
      }),
    )
    expect(mocks.apply).not.toHaveBeenCalled()
  })

  it('leaves the original state intact when strict decoding fails', async () => {
    mocks.read.mockResolvedValue({
      status: 'unavailable',
      result: { content: 'text_invalid_encoding' },
    })
    await expect(previewFileEncoding('f', 'gbk')).rejects.toThrow('text_invalid_encoding')
    expect(fileSaveCoordinator.getTextMetadata('f').format.encoding).toBe('utf-8')
    expect(mocks.apply).not.toHaveBeenCalled()
  })

  it('marks format changes dirty and uses the registered save handler', async () => {
    mocks.save.mockResolvedValue(false)
    const format = { encoding: 'gbk' as const, bom: 'none' as const }
    expect(await saveFileWithFormat('f', format)).toBe(false)
    expect(fileSaveCoordinator.getWriteOptions('f')).toMatchObject({
      format,
      encodingConfirmed: true,
    })
    expect(mocks.dirty).toHaveBeenCalledWith('f', { hasUnsavedChanges: true })
    expect(mocks.save).toHaveBeenCalledOnce()
  })
})

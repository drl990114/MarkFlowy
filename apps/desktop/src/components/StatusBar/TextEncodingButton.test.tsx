import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fileSaveCoordinator } from '@/components/EditorArea/fileSaveCoordinator'
import { DEFAULT_TEXT_METADATA } from '@/components/EditorArea/textFileFormat'
import { TextEncodingButton } from './TextEncodingButton'

const actions = vi.hoisted(() => ({ preview: vi.fn(), apply: vi.fn(), save: vi.fn() }))
vi.mock('@/helper/files', () => ({
  getFileObject: () => ({
    id: 'encoding-ui',
    path: '/note.md',
    name: 'note.md',
    kind: 'file',
    ext: 'md',
  }),
}))
vi.mock('@/stores/useEditorStore', () => ({
  default: (selector: (state: { activeId: string }) => unknown) =>
    selector({ activeId: 'encoding-ui' }),
}))
vi.mock('@/services/text-file-format', () => ({
  previewFileEncoding: actions.preview,
  applyEncodingPreview: actions.apply,
  saveFileWithFormat: actions.save,
}))

beforeEach(() => {
  vi.clearAllMocks()
  fileSaveCoordinator.loadSnapshot('encoding-ui', {
    content: '中文\r\n',
    revision: 'disk',
    status: 'success',
    text: {
      ...DEFAULT_TEXT_METADATA,
      format: { encoding: 'gb18030', bom: 'none' },
      lineEndings: { lf: 0, crlf: 1, cr: 0 },
      decoding: { source: 'heuristic', needsConfirmation: true, byteRoundTrip: true },
    },
  })
  actions.save.mockResolvedValue(false)
  actions.preview.mockRejectedValue(new Error('text_invalid_encoding'))
})
afterEach(cleanup)

describe('encoding status control', () => {
  it('separates reopening from saving and keeps a failed conversion visible', async () => {
    render(<TextEncodingButton />)
    expect(screen.getByText('GB18030 · CRLF · 待确认')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '文本编码与换行' }))
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByRole('button', { name: '预览重新打开' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '以此编码保存' }))
    await waitFor(() =>
      expect(actions.save).toHaveBeenCalledWith('encoding-ui', {
        encoding: 'gb18030',
        bom: 'none',
      }),
    )
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('尚未保存'))
    expect(actions.preview).not.toHaveBeenCalled()
  })

  it('shows a strict decode error without applying or saving', async () => {
    render(<TextEncodingButton />)
    fireEvent.click(screen.getByRole('button', { name: '文本编码与换行' }))
    fireEvent.click(screen.getByRole('button', { name: '预览重新打开' }))
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('text_invalid_encoding'),
    )
    expect(actions.apply).not.toHaveBeenCalled()
    expect(actions.save).not.toHaveBeenCalled()
  })
})

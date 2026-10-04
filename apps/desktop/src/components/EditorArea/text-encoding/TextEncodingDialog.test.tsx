import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fileSaveCoordinator } from '@/components/EditorArea/fileSaveCoordinator'
import { DEFAULT_TEXT_METADATA } from '@/components/EditorArea/textFileFormat'
import { TextEncodingDialog } from './TextEncodingDialog'
import { i18nInit } from '../../../../../../packages/i18n/src/desktop'

const actions = vi.hoisted(() => ({ preview: vi.fn(), apply: vi.fn(), save: vi.fn() }))
vi.mock('@/i18n', async () => import('../../../../../../packages/i18n/src/desktop'))
vi.mock('@/helper/files', () => ({
  getFileObject: () => ({
    id: 'encoding-ui',
    path: '/note.md',
    name: 'note.md',
    kind: 'file',
    ext: 'md',
  }),
}))
vi.mock('@/services/text-file-format', () => ({
  previewFileEncoding: actions.preview,
  applyEncodingPreview: actions.apply,
  saveFileWithFormat: actions.save,
}))

beforeEach(async () => {
  await i18nInit({ lng: 'cn' })
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
afterEach(() => {
  cleanup()
  document.body.replaceChildren()
})

describe('text encoding dialog', () => {
  it.each(['close', 'escape', 'save'])(
    'returns focus and selection to the current editor after %s',
    async (close) => {
      document.body.innerHTML = `
        <div data-editor-active="false"><textarea>background</textarea></div>
        <div data-editor-active="true"><textarea>current selection</textarea></div>
      `
      const current = document.querySelector<HTMLTextAreaElement>(
        '[data-editor-active="true"] textarea',
      )!
      current.focus()
      current.setSelectionRange(2, 7, 'backward')
      const view = render(<TextEncodingDialog fileId='encoding-ui' onClose={() => view.unmount()} />)
      expect(document.activeElement).not.toBe(current)
      if (close === 'escape') fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
      else if (close === 'save') {
        actions.save.mockResolvedValue(true)
        fireEvent.click(screen.getByRole('button', { name: '以此编码保存' }))
      } else fireEvent.click(screen.getByRole('button', { name: '关闭' }))
      await waitFor(() => expect(document.activeElement).toBe(current))
      expect([current.selectionStart, current.selectionEnd, current.selectionDirection]).toEqual([
        2, 7, 'backward',
      ])
    },
  )

  it('separates reopening from saving and keeps a failed conversion visible', async () => {
    render(<TextEncodingDialog fileId='encoding-ui' onClose={vi.fn()} />)
    expect(screen.getByText('note.md · GB18030 · CRLF · 待确认')).toBeTruthy()
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
    render(<TextEncodingDialog fileId='encoding-ui' onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '预览重新打开' }))
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('text_invalid_encoding'),
    )
    expect(actions.apply).not.toHaveBeenCalled()
    expect(actions.save).not.toHaveBeenCalled()
  })
})

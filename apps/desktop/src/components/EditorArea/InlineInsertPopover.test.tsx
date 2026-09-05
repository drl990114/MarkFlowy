import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { InlineInsertPopover } from './InlineInsertPopover'
import type {
  CapricornInlineEditRequest,
  CapricornRuntimeAdapter,
  CapricornSelectionBookmark,
} from './capricornRuntimeAdapter'
import { chooseInlineImage, formatInlineAddress } from './inlineInsert'
import { handleInsertLocalImage } from './imageHandlers'
import type * as InlineInsertModule from './inlineInsert'

vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('./inlineInsert', async (original) => ({
  ...(await original<typeof InlineInsertModule>()),
  chooseInlineImage: vi.fn(),
}))
vi.mock('./imageHandlers', () => ({ handleInsertLocalImage: vi.fn() }))

afterEach(cleanup)
beforeEach(() => vi.clearAllMocks())

function harness() {
  let open: (request: CapricornInlineEditRequest | null) => void = () => undefined
  let uiChange: () => void = () => undefined
  let valid = true
  const bookmark: CapricornSelectionBookmark = {
    id: 'original-position',
    text: '',
    isCollapsed: true,
    canInsertInline: true,
    link: null,
    image: null,
  }
  const editor = {
    commands: {
      insertLink: vi.fn(),
      updateLink: vi.fn(),
      removeLink: vi.fn(),
      insertImage: vi.fn(),
      updateImage: vi.fn(),
      removeImage: vi.fn(),
    },
    selection: {
      capture: vi.fn(() => bookmark),
      getRect: () => ({ x: 40, y: 40, width: 20, height: 20 }),
      isValid: () => valid,
      restore: vi.fn(() => valid),
      release: vi.fn(),
    },
    focus: vi.fn(),
    subscribeInlineEdit: (listener: typeof open) => {
      open = listener
      return () => {
        open = () => undefined
      }
    },
    subscribeUiState: (listener: typeof uiChange) => {
      uiChange = listener
      return () => undefined
    },
  } as unknown as CapricornRuntimeAdapter
  return {
    editor,
    bookmark,
    show(kind: 'link' | 'image', focus = true) {
      act(() => open({ kind, bookmark, focus }))
    },
    invalidate() {
      valid = false
      act(() => uiChange())
    },
    documentChanged() {
      act(() => open(null))
    },
  }
}

describe('InlineInsertPopover', () => {
  it.each(['link', 'image'] as const)(
    'shows Chinese %s addresses and preserves an unchanged source',
    async (kind) => {
      const h = harness()
      const source = './%E5%85%B3%E4%BA%8E%23%3F%2F%2520.png'
      if (kind === 'link') h.bookmark.link = { key: 'link-1', href: source }
      else h.bookmark.image = { key: 'image-1', src: source, alt: '图片' }
      render(<InlineInsertPopover editor={h.editor} active />)
      h.show(kind)
      expect(screen.getByDisplayValue('./关于%23%3F%2F%2520.png')).toBeTruthy()
      fireEvent.click(screen.getByText('inline_insert.save'))
      await waitFor(() => {
        if (kind === 'link')
          expect(h.editor.commands.updateLink).toHaveBeenCalledWith({ href: source })
        else
          expect(h.editor.commands.updateImage).toHaveBeenCalledWith('image-1', {
            src: source,
            alt: '图片',
          })
      })
    },
  )

  it('keeps a Base64 image intact when editing its description', async () => {
    const h = harness()
    const src =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8L8AAAAASUVORK5CYII='
    h.bookmark.image = { key: 'image-1', src, alt: '旧说明' }
    render(<InlineInsertPopover editor={h.editor} active />)
    h.show('image')
    expect(screen.getByDisplayValue(src)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('inline_insert.alt'), { target: { value: '新说明' } })
    fireEvent.click(screen.getByText('inline_insert.save'))
    await waitFor(() =>
      expect(h.editor.commands.updateImage).toHaveBeenCalledWith('image-1', { src, alt: '新说明' }),
    )
  })

  it('retains malformed escapes and data URLs when formatting an address', () => {
    for (const value of ['./100%.png', './%E4%B8%AD%FF.png', 'data:image/svg+xml,%3Csvg%3E']) {
      expect(formatInlineAddress(value)).toBe(value)
    }
  })

  it('restores the captured caret before insertion and returns focus to the editor', async () => {
    const h = harness()
    render(<InlineInsertPopover editor={h.editor} active editorId='doc-1' />)
    h.show('link')
    const address = screen.getByLabelText('inline_insert.address')
    await waitFor(() => expect(document.activeElement).toBe(address))
    fireEvent.change(address, { target: { value: 'https://example.com' } })
    fireEvent.change(screen.getByLabelText('inline_insert.text'), { target: { value: '官网' } })
    fireEvent.click(screen.getByText('inline_insert.insert'))
    await waitFor(() =>
      expect(h.editor.commands.insertLink).toHaveBeenCalledWith({
        href: 'https://example.com',
        text: '官网',
      }),
    )
    expect(h.editor.selection!.restore).toHaveBeenCalledWith('original-position')
    expect(h.editor.focus).toHaveBeenCalledOnce()
    expect(screen.queryByLabelText('inline_insert.address')).toBeNull()
  })

  it('wraps selected formatted text without supplying replacement text', async () => {
    const h = harness()
    h.bookmark.isCollapsed = false
    h.bookmark.text = '**selected**'
    render(<InlineInsertPopover editor={h.editor} active />)
    h.show('link')
    expect(screen.queryByLabelText('inline_insert.text')).toBeNull()
    fireEvent.change(screen.getByLabelText('inline_insert.address'), {
      target: { value: './notes.md' },
    })
    fireEvent.click(screen.getByText('inline_insert.insert'))
    await waitFor(() =>
      expect(h.editor.commands.insertLink).toHaveBeenCalledWith({ href: './notes.md' }),
    )
  })

  it('keeps focus in the document when inspecting a clicked link and unwraps it explicitly', async () => {
    const h = harness()
    h.bookmark.link = { key: 'link-1', href: 'https://example.com' }
    render(
      <>
        <textarea aria-label='document' />
        <InlineInsertPopover editor={h.editor} active />
      </>,
    )
    const input = screen.getByLabelText('document')
    input.focus()
    h.show('link', false)
    await waitFor(() => expect(screen.getByDisplayValue('https://example.com')).toBeTruthy())
    expect(document.activeElement).toBe(input)
    fireEvent.click(screen.getByText('inline_insert.unlink'))
    expect(h.editor.commands.removeLink).toHaveBeenCalledOnce()
    expect(h.editor.selection!.restore).toHaveBeenCalledOnce()
  })

  it('cancels with Escape without inserting and restores the original selection', () => {
    const h = harness()
    render(<InlineInsertPopover editor={h.editor} active />)
    h.show('image')
    fireEvent.keyDown(screen.getByLabelText('inline_insert.address'), { key: 'Escape' })
    expect(h.editor.commands.insertImage).not.toHaveBeenCalled()
    expect(h.editor.selection!.restore).toHaveBeenCalledWith('original-position')
  })

  it('keeps the selected file as a draft and ignores an upload after switching documents', async () => {
    const h = harness()
    let finish: (result: { src: string }) => void = () => undefined
    vi.mocked(chooseInlineImage).mockResolvedValue('/photos/picture.png')
    vi.mocked(handleInsertLocalImage).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const view = render(<InlineInsertPopover editor={h.editor} active editorId='doc-1' />)
    h.show('image')
    fireEvent.click(screen.getByText('inline_insert.choose_image'))
    await screen.findByText('picture.png')
    expect(handleInsertLocalImage).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('inline_insert.insert'))
    await waitFor(() =>
      expect(handleInsertLocalImage).toHaveBeenCalledWith('/photos/picture.png', 'doc-1', {
        throwOnError: true,
      }),
    )
    view.rerender(<InlineInsertPopover editor={h.editor} active={false} editorId='doc-1' />)
    await act(async () => finish({ src: './assets/picture.png' }))
    expect(h.editor.commands.insertImage).not.toHaveBeenCalled()
    expect(h.editor.focus).not.toHaveBeenCalled()
  })

  it('preserves the form on storage failure, then allows retry exactly once', async () => {
    const h = harness()
    vi.mocked(chooseInlineImage).mockResolvedValue('/photos/photo.png')
    vi.mocked(handleInsertLocalImage)
      .mockRejectedValueOnce(new Error('disk'))
      .mockResolvedValue({ src: './assets/photo.png' })
    render(<InlineInsertPopover editor={h.editor} active />)
    h.show('image')
    fireEvent.click(screen.getByText('inline_insert.choose_image'))
    await screen.findByText('photo.png')
    fireEvent.click(screen.getByText('inline_insert.insert'))
    await screen.findByRole('alert')
    expect(screen.getByDisplayValue('photo')).toBeTruthy()
    fireEvent.click(screen.getByText('inline_insert.insert'))
    await waitFor(() =>
      expect(h.editor.commands.insertImage).toHaveBeenCalledExactlyOnceWith({
        src: './assets/photo.png',
        alt: 'photo',
      }),
    )
  })

  it('does not apply an old upload to a replacement editor with an identical bookmark id', async () => {
    const first = harness()
    const second = harness()
    let finish: (result: { src: string }) => void = () => undefined
    vi.mocked(chooseInlineImage).mockResolvedValue('/photos/picture.png')
    vi.mocked(handleInsertLocalImage).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const view = render(<InlineInsertPopover editor={first.editor} active editorId='doc-1' />)
    first.show('image')
    fireEvent.click(screen.getByText('inline_insert.choose_image'))
    await screen.findByText('picture.png')
    fireEvent.click(screen.getByText('inline_insert.insert'))
    await waitFor(() => expect(handleInsertLocalImage).toHaveBeenCalledOnce())
    view.rerender(<InlineInsertPopover editor={second.editor} active editorId='doc-2' />)
    second.show('link')
    await act(async () => finish({ src: './assets/picture.png' }))
    expect(first.editor.commands.insertImage).not.toHaveBeenCalled()
    expect(second.editor.commands.insertImage).not.toHaveBeenCalled()
    expect(screen.getByLabelText('inline_insert.address')).toBeTruthy()
    second.documentChanged()
    expect(screen.queryByLabelText('inline_insert.address')).toBeNull()
  })

  it('rejects script URLs and closes when the captured document becomes invalid', () => {
    const h = harness()
    render(<InlineInsertPopover editor={h.editor} active />)
    h.show('link')
    fireEvent.change(screen.getByLabelText('inline_insert.address'), {
      target: { value: 'javascript:alert(1)' },
    })
    fireEvent.click(screen.getByText('inline_insert.insert'))
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(h.editor.commands.insertLink).not.toHaveBeenCalled()
    h.invalidate()
    expect(screen.queryByLabelText('inline_insert.address')).toBeNull()
  })

  it('shows image actions without stealing focus and updates the existing image', async () => {
    const h = harness()
    h.bookmark.image = { key: 'image-1', src: './old.png', alt: 'Old' }
    render(<InlineInsertPopover editor={h.editor} active />)
    h.show('image', false)
    expect(screen.queryByLabelText('inline_insert.address')).toBeNull()
    fireEvent.click(screen.getByText('inline_insert.replace_image'))
    fireEvent.change(screen.getByLabelText('inline_insert.address'), {
      target: { value: './new.png' },
    })
    fireEvent.click(screen.getByText('inline_insert.save'))
    await waitFor(() =>
      expect(h.editor.commands.updateImage).toHaveBeenCalledWith('image-1', {
        src: './new.png',
        alt: 'Old',
      }),
    )
    expect(h.editor.commands.insertImage).not.toHaveBeenCalled()
  })
})

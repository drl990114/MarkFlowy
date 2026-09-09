import { desktopLightTheme } from '@markflowy/theme'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { createRef, StrictMode } from 'react'
import { ThemeProvider } from 'styled-components'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { isCapricornRuntimeAvailable } from '@/constants/capricornRuntime'
import { EditorViewType } from '@/constants/editorViewType'
import zhCNLocale from '../../../../../locales/zh-CN.json'
import { CapricornEditor, type CapricornEditorHandle } from './CapricornEditor'
import { EditorWrapper } from './EditorWrapper'
import {
  CAPRICORN_DESKTOP_VIRTUALIZE_OPTIONS,
  loadCapricornRuntimeFactory,
  type CapricornRuntimeAdapter,
} from './capricornRuntimeAdapter'

vi.mock('@/i18n', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      (
        ({
          'capricorn.editor.load_failed': 'Unable to load the Capricorn editor',
          'capricorn.editor.loading': 'Loading Capricorn editor',
          'capricorn.editor.opening': 'Opening document',
          'capricorn.editor.preparation_failed':
            'Background document preparation failed. Please retry.',
          'common.retry': 'Retry',
        }) as Record<string, string>
      )[key] ?? key,
  }),
}))

afterEach(cleanup)

describe.skipIf(!isCapricornRuntimeAvailable)('CapricornEditor with the published runtime', () => {
  it('switches edit and preview in place, keeping content and undo while blocking preview edits', async () => {
    const ref = createRef<CapricornEditorHandle>()
    const onChange = vi.fn()
    const onError = vi.fn()
    const onUnavailable = vi.fn()
    const onEditorChange = vi.fn()
    const props = {
      ref,
      active: true,
      initialMarkdown: '# Heading\n\n- [ ] Task',
      onChange,
      onError,
      onUnavailable,
      onEditorChange,
    }
    const { container, rerender } = render(
      <CapricornEditor {...props} options={{ mode: 'edit' }} />,
    )
    await waitFor(() => expect(onEditorChange).toHaveBeenCalled())
    const adapter = onEditorChange.mock.calls[0][0] as CapricornRuntimeAdapter
    const root = container.querySelector('[data-cap-content]')!
    await act(async () => adapter.commands.setBlockType('heading-2'))
    const edited = ref.current!.getMarkdown()
    expect(edited).toContain('## Heading')
    expect(adapter.getUiState().canUndo).toBe(true)
    onChange.mockClear()

    await act(async () => rerender(<CapricornEditor {...props} options={{ mode: 'preview' }} />))
    await waitFor(() => expect(root.getAttribute('data-cap-mode')).toBe('preview'))
    expect(adapter.getUiState().readOnly).toBe(true)
    expect(container.querySelector<HTMLInputElement>('input[type="checkbox"]')?.disabled).toBe(true)
    await act(async () => {
      adapter.commands.setBlockType('heading-3')
      fireEvent.click(container.querySelector('input[type="checkbox"]')!)
    })
    expect(ref.current!.getMarkdown()).toBe(edited)
    expect(onChange).not.toHaveBeenCalledWith(expect.objectContaining({ documentChanged: true }))

    await act(async () => rerender(<CapricornEditor {...props} options={{ mode: 'edit' }} />))
    await waitFor(() => expect(root.getAttribute('data-cap-mode')).toBe('edit'))
    expect(adapter.getUiState().readOnly).toBe(false)
    expect(container.querySelector('[data-cap-content]')).toBe(root)
    expect(onEditorChange.mock.calls.filter(([editor]) => editor !== null)).toHaveLength(1)
    expect(ref.current!.getMarkdown()).toBe(edited)
    await act(async () => adapter.commands.undo())
    expect(ref.current!.getMarkdown()).toContain('# Heading')
    expect(ref.current!.getMarkdown()).not.toContain('## Heading')
    expect(onError).not.toHaveBeenCalled()
    expect(onUnavailable).not.toHaveBeenCalled()
  })

  it('opens directly in preview without stealing focus and accepts external content', async () => {
    const externalInput = document.createElement('input')
    document.body.append(externalInput)
    externalInput.focus()
    const ref = createRef<CapricornEditorHandle>()
    const onChange = vi.fn()
    const onError = vi.fn()
    const handleLinkClick = vi.fn()
    const { container, unmount } = render(
      <CapricornEditor
        ref={ref}
        active
        initialMarkdown='# Preview\n\n[Link](https://example.com)'
        onChange={onChange}
        onError={onError}
        onUnavailable={onError}
        options={{ mode: 'preview', handleLinkClick }}
      />,
    )
    await waitFor(() => expect(container.querySelector('[data-cap-mode="preview"]')).not.toBeNull())
    expect(document.activeElement).toBe(externalInput)
    await act(async () =>
      fireEvent.click(container.querySelector('a[href="https://example.com"]')!),
    )
    expect(handleLinkClick).toHaveBeenCalledWith('https://example.com')
    await act(async () =>
      fireEvent.keyDown(container.querySelector('a[href="https://example.com"]')!, {
        key: 'Enter',
      }),
    )
    expect(handleLinkClick).toHaveBeenCalledTimes(2)
    await act(async () => ref.current!.setMarkdown('# External update'))
    expect(container.textContent).toContain('External update')
    expect(ref.current!.getMarkdown()).toBe('# External update')
    expect(onChange).not.toHaveBeenCalledWith(expect.objectContaining({ documentChanged: true }))
    expect(onError).not.toHaveBeenCalled()
    await act(async () => unmount())
    externalInput.remove()
  })

  it.each([false, true])(
    'applies placeholder settings to the installed package (strict=%s)',
    async (strict) => {
      await loadCapricornRuntimeFactory()
      const ref = createRef<CapricornEditorHandle>()
      const onChange = vi.fn()
      const onEditorChange = vi.fn()
      const onError = vi.fn()
      const onUnavailable = vi.fn()
      const localization = {
        translate: ({ key, defaultValue }: { key: string; defaultValue: string }) =>
          key === 'placeholder.default' ? zhCNLocale.capricorn.placeholder.default : defaultValue,
      }
      const element = (enabled: boolean, placeholder?: string) => {
        const editor = (
          <CapricornEditor
            ref={ref}
            active
            initialMarkdown=''
            onChange={onChange}
            onEditorChange={onEditorChange}
            onError={onError}
            onUnavailable={onUnavailable}
            options={{
              placeholder: { enabled, placeholder },
              localization,
              virtualize: CAPRICORN_DESKTOP_VIRTUALIZE_OPTIONS,
            }}
          />
        )
        return strict ? <StrictMode>{editor}</StrictMode> : editor
      }
      const { container, rerender, unmount } = render(element(false))
      await waitFor(() =>
        expect(onEditorChange.mock.calls.filter(([adapter]) => adapter !== null)).toHaveLength(1),
      )
      const root = container.querySelector('[data-cap-content]')
      expect(root).not.toBeNull()
      expect(container.querySelector('[data-cap-placeholder]')).toBeNull()
      await act(async () => rerender(element(true)))
      await waitFor(() =>
        expect(
          container.querySelector('[data-cap-placeholder]')?.getAttribute('data-placeholder'),
        ).toBe('输入 / 使用命令'),
      )
      await act(async () => rerender(element(true, 'Custom hint')))
      await waitFor(() =>
        expect(
          container.querySelector('[data-cap-placeholder]')?.getAttribute('data-placeholder'),
        ).toBe('Custom hint'),
      )
      await act(async () => rerender(element(false)))
      await waitFor(() => expect(container.querySelector('[data-cap-placeholder]')).toBeNull())
      expect(container.querySelector('[data-cap-content]')).toBe(root)
      expect(ref.current?.getMarkdown()).toBe('')
      expect(onEditorChange.mock.calls.filter(([adapter]) => adapter !== null)).toHaveLength(1)
      expect(onChange).not.toHaveBeenCalledWith(expect.objectContaining({ documentChanged: true }))
      await act(async () => rerender(element(true)))
      await act(async () => ref.current?.setMarkdown('Hello'))
      await waitFor(() => expect(container.querySelector('[data-cap-placeholder]')).toBeNull())
      await act(async () => ref.current?.setMarkdown(''))
      await waitFor(() =>
        expect(
          container.querySelector('[data-cap-placeholder]')?.getAttribute('data-placeholder'),
        ).toBe('输入 / 使用命令'),
      )
      expect(onError).not.toHaveBeenCalled()
      expect(onUnavailable).not.toHaveBeenCalled()
      await act(async () => unmount())
      expect(onEditorChange).toHaveBeenLastCalledWith(null)
    },
  )

  it.each([false, true])('updates full width without remounting (strict=%s)', async (strict) => {
    await loadCapricornRuntimeFactory()
    const onError = vi.fn()
    const onUnavailable = vi.fn()
    const onEditorChange = vi.fn()
    const onChange = vi.fn()
    const ref = createRef<CapricornEditorHandle>()
    const editor = (
      <CapricornEditor
        ref={ref}
        active
        initialMarkdown='# Published host'
        onChange={onChange}
        onError={onError}
        onUnavailable={onUnavailable}
        onEditorChange={onEditorChange}
        options={{ virtualize: CAPRICORN_DESKTOP_VIRTUALIZE_OPTIONS }}
      />
    )
    const withLayout = (fullWidth: boolean) => {
      const layout = (
        <ThemeProvider theme={desktopLightTheme}>
          <EditorWrapper
            $editorViewType={EditorViewType.WYSIWYG}
            $fileType='markdown'
            $fullWidth={fullWidth}
            $rootLineHeight='1.7'
            $visible
          >
            {editor}
          </EditorWrapper>
        </ThemeProvider>
      )
      return strict ? <StrictMode>{layout}</StrictMode> : layout
    }
    const { container, rerender, unmount } = render(withLayout(false))
    await waitFor(() => {
      expect(onError).not.toHaveBeenCalled()
      expect(onUnavailable).not.toHaveBeenCalled()
      expect(container.querySelector('[data-cap-content]')).not.toBeNull()
    })
    await act(async () => ref.current?.waitForResources())
    const content = container.querySelector<HTMLElement>('[data-cap-content]')!
    const inlinePadding = getComputedStyle(content).getPropertyValue('--cap-editor-inline-padding')
    expect(getComputedStyle(content).getPropertyValue('--cap-editor-content-width')).toBe('760px')
    for (const fullWidth of [true, false]) {
      rerender(withLayout(fullWidth))
      expect(container.querySelector('[data-cap-content]')).toBe(content)
      expect(getComputedStyle(content).getPropertyValue('--cap-editor-content-width')).toBe(
        fullWidth ? '100%' : '760px',
      )
      expect(getComputedStyle(content).getPropertyValue('--cap-editor-inline-padding')).toBe(
        inlinePadding,
      )
    }
    expect(ref.current?.getMarkdown()).toBe('# Published host')
    expect(onChange).not.toHaveBeenCalledWith(expect.objectContaining({ documentChanged: true }))
    expect(onEditorChange.mock.calls.filter(([adapter]) => adapter !== null)).toHaveLength(1)
    await act(async () => unmount())
    expect(onEditorChange).toHaveBeenLastCalledWith(null)
  })
})

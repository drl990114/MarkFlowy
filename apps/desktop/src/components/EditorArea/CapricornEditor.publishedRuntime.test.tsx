import { desktopLightTheme } from '@markflowy/theme'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { createRef, StrictMode } from 'react'
import { ThemeProvider } from 'styled-components'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { isCapricornRuntimeAvailable } from '@/constants/capricornRuntime'
import { EditorViewType } from '@/constants/editorViewType'
import { CapricornEditor, type CapricornEditorHandle } from './CapricornEditor'
import { EditorWrapper } from './EditorWrapper'
import {
  CAPRICORN_DESKTOP_VIRTUALIZE_OPTIONS,
  loadCapricornRuntimeFactory,
} from './capricornRuntimeAdapter'

afterEach(cleanup)

describe.skipIf(!isCapricornRuntimeAvailable)('CapricornEditor with the published runtime', () => {
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

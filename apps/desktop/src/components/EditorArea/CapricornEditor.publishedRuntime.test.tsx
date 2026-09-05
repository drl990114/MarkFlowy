import { act, cleanup, render, waitFor } from '@testing-library/react'
import { createRef, StrictMode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { isCapricornRuntimeAvailable } from '@/constants/capricornRuntime'
import { CapricornEditor, type CapricornEditorHandle } from './CapricornEditor'
import {
  CAPRICORN_DESKTOP_VIRTUALIZE_OPTIONS,
  loadCapricornRuntimeFactory,
} from './capricornRuntimeAdapter'

afterEach(cleanup)

describe.skipIf(!isCapricornRuntimeAvailable)('CapricornEditor with the published runtime', () => {
  it.each([false, true])('mounts a preloaded package inside the host (strict=%s)', async (strict) => {
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
    const { container, unmount } = render(strict ? <StrictMode>{editor}</StrictMode> : editor)
    await waitFor(() => {
      expect(onError).not.toHaveBeenCalled()
      expect(onUnavailable).not.toHaveBeenCalled()
      expect(container.querySelector('[data-cap-content]')).not.toBeNull()
    })
    await act(async () => ref.current?.waitForResources())
    expect(ref.current?.getMarkdown()).toBe('# Published host')
    expect(onChange).not.toHaveBeenCalledWith(expect.objectContaining({ documentChanged: true }))
    expect(onEditorChange.mock.calls.filter(([adapter]) => adapter !== null)).toHaveLength(1)
    await act(async () => unmount())
    expect(onEditorChange).toHaveBeenLastCalledWith(null)
  })
})

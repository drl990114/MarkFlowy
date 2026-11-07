// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  capricornEditorInstanceRegistry,
  setCapricornEditor,
} from '@/components/EditorArea/capricornEditorRegistry'
import type { CapricornHeading, CapricornRuntimeAdapter } from '@/components/EditorArea/capricornRuntimeAdapter'
import { EditorViewType } from '@/constants/editorViewType'
import type { EditorCommandTarget } from './editorCommandTarget'
import { usePaletteUpdates } from './usePaletteUpdates'

vi.mock('@/commands', () => ({
  commandRegistry: { onDidChangeCommands: () => ({ dispose: vi.fn() }) },
}))
vi.mock('@/stores/useEditorStore', () => ({ default: { subscribe: () => vi.fn() } }))

const fileId = 'palette-heading-lifecycle'
afterEach(() => {
  cleanup()
  setCapricornEditor(fileId, undefined)
  capricornEditorInstanceRegistry.remove(fileId, 'left-instance')
  capricornEditorInstanceRegistry.remove(fileId, 'right-instance')
})

function createEditor() {
  let destroyed = false
  const headingListeners = new Set<(headings: CapricornHeading[]) => void>()
  const uiListeners = new Set<() => void>()
  const unsubscribeHeadings = vi.fn(() => headingListeners.clear())
  const unsubscribeUi = vi.fn(() => uiListeners.clear())
  const subscribeHeadings = vi.fn((listener: (headings: CapricornHeading[]) => void) => {
    // The published runtime rejects subscriptions after destruction.
    if (destroyed) throw new Error('Capricorn editor session is destroyed.')
    headingListeners.add(listener)
    return unsubscribeHeadings
  })
  const subscribeUiState = vi.fn((listener: () => void) => {
    if (!destroyed) uiListeners.add(listener)
    return unsubscribeUi
  })
  const editor = {
    subscribeUiState,
    headings: { subscribe: subscribeHeadings },
  } as unknown as CapricornRuntimeAdapter
  return {
    editor, subscribeHeadings, subscribeUiState, unsubscribeHeadings, unsubscribeUi,
    publishHeadings: () => headingListeners.forEach((listener) => listener([])),
    publishUi: () => uiListeners.forEach((listener) => listener()),
    destroy: () => {
      destroyed = true
      headingListeners.clear()
      uiListeners.clear()
    },
  }
}

function targetFor(editor: CapricornRuntimeAdapter, resourceGroupId?: string): EditorCommandTarget {
  return { fileId, groupId: 'left', resourceGroupId, mode: EditorViewType.WYSIWYG, rich: editor }
}

describe('command palette heading subscription lifecycle', () => {
  it.each(['removed', 'replaced'] as const)('skips a captured editor %s before the lazy palette mounts', (change) => {
    const captured = createEditor()
    const replacement = createEditor()
    setCapricornEditor(fileId, captured.editor)
    const target = targetFor(captured.editor)
    captured.destroy()
    setCapricornEditor(fileId, change === 'replaced' ? replacement.editor : undefined)

    const rendered = vi.fn()
    const hook = renderHook(() => {
      usePaletteUpdates(target)
      rendered()
    })
    expect(captured.subscribeHeadings).not.toHaveBeenCalled()
    expect(captured.subscribeUiState).not.toHaveBeenCalled()
    expect(replacement.subscribeHeadings).not.toHaveBeenCalled()
    // Global subscriptions still refresh the stale-command status.
    const renders = rendered.mock.calls.length
    act(() => setCapricornEditor(fileId, createEditor().editor))
    expect(rendered.mock.calls.length).toBeGreaterThan(renders)
    hook.unmount()
  })

  it('refreshes heading and UI state and disposes subscriptions when the target changes or closes', () => {
    const first = createEditor()
    const second = createEditor()
    setCapricornEditor(fileId, first.editor)
    const rendered = vi.fn()
    const hook = renderHook(({ target }) => {
      usePaletteUpdates(target)
      rendered()
    }, { initialProps: { target: targetFor(first.editor) } })
    expect(first.subscribeHeadings).toHaveBeenCalledOnce()
    expect(first.subscribeUiState).toHaveBeenCalledOnce()
    for (const publish of [first.publishHeadings, first.publishUi]) {
      const renders = rendered.mock.calls.length
      act(publish)
      expect(rendered.mock.calls.length).toBeGreaterThan(renders)
    }

    act(() => setCapricornEditor(fileId, second.editor))
    hook.rerender({ target: targetFor(second.editor) })
    expect(first.unsubscribeHeadings).toHaveBeenCalledOnce()
    expect(first.unsubscribeUi).toHaveBeenCalledOnce()
    expect(second.subscribeHeadings).toHaveBeenCalledOnce()
    expect(second.subscribeUiState).toHaveBeenCalledOnce()
    const renders = rendered.mock.calls.length
    act(first.publishHeadings)
    expect(rendered).toHaveBeenCalledTimes(renders)

    hook.unmount()
    expect(second.unsubscribeHeadings).toHaveBeenCalledOnce()
    expect(second.unsubscribeUi).toHaveBeenCalledOnce()
    act(second.publishHeadings)
    expect(rendered).toHaveBeenCalledTimes(renders)
  })

  it('uses the captured pane registry instead of a sibling compatibility alias', () => {
    const left = createEditor()
    const right = createEditor()
    capricornEditorInstanceRegistry.register(fileId, 'left-instance', left.editor, 'left')
    capricornEditorInstanceRegistry.register(fileId, 'right-instance', right.editor, 'right')
    setCapricornEditor(fileId, right.editor)
    const hook = renderHook(() => usePaletteUpdates(targetFor(left.editor, 'left')))
    expect(left.subscribeHeadings).toHaveBeenCalledOnce()
    expect(right.subscribeHeadings).not.toHaveBeenCalled()
    hook.unmount()
    expect(left.unsubscribeHeadings).toHaveBeenCalledOnce()

    // A stale compatibility alias must not revive the removed pane either.
    capricornEditorInstanceRegistry.remove(fileId, 'left-instance')
    setCapricornEditor(fileId, left.editor)
    left.destroy()
    renderHook(() => usePaletteUpdates(targetFor(left.editor, 'left')))
    expect(left.subscribeHeadings).toHaveBeenCalledOnce()
    expect(right.subscribeHeadings).not.toHaveBeenCalled()
  })
})

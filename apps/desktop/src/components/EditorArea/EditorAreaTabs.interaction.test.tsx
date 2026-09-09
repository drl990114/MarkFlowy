import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { desktopLightTheme } from '@markflowy/theme'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { checkUnsavedFiles } from '@/services/checkUnsavedFiles'
import { TooltipProvider } from '@/components/ui/tooltip'
import EditorAreaTabs from './EditorAreaTabs'

const state = vi.hoisted(() => ({
  dirty: true,
  close: vi.fn(),
  check: vi.fn(),
  save: vi.fn(),
  listeners: new Set<() => void>(),
  group: { id: 'group', activeId: 'file', opened: ['file'] },
}))
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@/services/checkUnsavedFiles', () => ({
  checkUnsavedFiles: state.check,
  saveUnsavedFiles: state.save,
}))
vi.mock('@/helper/files', () => ({
  default: (selector: (value: unknown) => unknown) =>
    selector({ entries: { file: { name: 'Document.md' } } }),
}))
vi.mock('@/stores', async () => {
  const { useSyncExternalStore } = await import('react')
  const editor = { getGroup: () => state.group, closeFileInGroup: state.close }
  return {
    useEditorStore: Object.assign((selector: (value: unknown) => unknown) => selector(editor), {
      getState: () => editor,
    }),
    useEditorStateStore: (selector: (value: unknown) => unknown) => {
      const dirty = useSyncExternalStore(
        (listener) => {
          state.listeners.add(listener)
          return () => {
            state.listeners.delete(listener)
          }
        },
        () => state.dirty,
      )
      return selector({ idStateMap: new Map([['file', { hasUnsavedChanges: dirty }]]) })
    },
  }
})
vi.mock('./EditorAreaHeader', () => ({ EditorAreaHeader: () => null }))
vi.mock('../ui-v2/ContextMenu', () => ({ showContextMenu: vi.fn() }))

function tabs() {
  return (
    <ThemeProvider theme={desktopLightTheme}>
      <TooltipProvider>
        <EditorAreaTabs groupId='group' />
      </TooltipProvider>
    </ThemeProvider>
  )
}

beforeEach(() => {
  state.dirty = true
  vi.clearAllMocks()
  state.check.mockImplementation(() => (state.dirty ? 1 : 0))
  state.save.mockResolvedValue(true)
})
afterEach(cleanup)

describe('editor tab close affordance', () => {
  it('keeps the same close control and trailing slot across saved and unsaved states', () => {
    render(tabs())
    const close = screen.getByRole('button', { name: 'contextmenu.editor_tab.close' })
    const slot = close.parentElement
    expect(slot?.querySelector('.mf-editor-tab-dirty')).not.toBeNull()
    act(() => {
      state.dirty = false
      state.listeners.forEach((listener) => listener())
    })
    expect(screen.getByRole('button', { name: 'contextmenu.editor_tab.close' })).toBe(close)
    expect(close.parentElement).toBe(slot)
    expect(slot?.querySelector('.mf-editor-tab-dirty')).toBeNull()
  })

  it('routes dirty close through confirmation and retains the tab when saving fails', async () => {
    render(tabs())
    fireEvent.click(screen.getByRole('button', { name: 'contextmenu.editor_tab.close' }))
    expect(state.close).not.toHaveBeenCalled()
    const options = state.check.mock.calls[0][0] as Parameters<typeof checkUnsavedFiles>[0]
    expect(options.fileIds).toEqual(['file'])
    state.save.mockResolvedValueOnce(false)
    await act(async () => {
      await options.onSaveAndClose?.(['file'])
    })
    expect(state.close).not.toHaveBeenCalled()
    await act(async () => {
      await options.onSaveAndClose?.(['file'])
    })
    expect(state.close).toHaveBeenCalledWith('group', 'file')
  })

  it('closes clean tabs immediately and restores keyboard focus', async () => {
    state.dirty = false
    render(tabs())
    fireEvent.click(screen.getByRole('button', { name: 'contextmenu.editor_tab.close' }))
    expect(state.close).toHaveBeenCalledWith('group', 'file')
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('tab')))
    expect(screen.getByRole('tab').getAttribute('aria-controls')).toBe('editor-panel-group')
  })
})

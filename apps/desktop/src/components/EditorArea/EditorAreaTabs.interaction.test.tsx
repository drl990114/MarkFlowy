import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { desktopLightTheme } from '@markflowy/theme'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { checkUnsavedFiles } from '@/services/checkUnsavedFiles'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { showContextMenu } from '../ui-v2/ContextMenu'
import EditorAreaTabs from './EditorAreaTabs'

const state = vi.hoisted(() => ({
  dirty: true,
  close: vi.fn(),
  check: vi.fn(),
  save: vi.fn(),
  keepOpen: vi.fn(),
  open: vi.fn(),
  menu: vi.fn(),
  listeners: new Set<() => void>(),
  group: { id: 'group', activeId: 'file', opened: ['file'], previewId: undefined as string | undefined },
}))
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@/services/checkUnsavedFiles', () => ({
  checkUnsavedFiles: state.check,
  saveUnsavedFiles: state.save,
}))
vi.mock('@/helper/files', () => ({
  default: (selector: (value: unknown) => unknown) =>
    selector({ entries: { file: { name: 'Document.md' }, other: { name: 'Other.md' } } }),
}))
vi.mock('@/stores', async () => {
  const { useSyncExternalStore } = await import('react')
  const editor = {
    getGroup: () => state.group,
    closeFileInGroup: state.close,
    openFileInGroup: state.open,
    keepFileOpen: state.keepOpen,
  }
  return {
    useEditorStore: Object.assign((selector: (value: unknown) => unknown) => {
      const group = useSyncExternalStore(
        (listener) => {
          state.listeners.add(listener)
          return () => { state.listeners.delete(listener) }
        },
        () => state.group,
      )
      return selector({ ...editor, getGroup: () => group })
    }, { getState: () => editor }),
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
vi.mock('../ui-v2/ContextMenu', () => ({ showContextMenu: state.menu }))

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
  state.group.previewId = undefined
  vi.clearAllMocks()
  state.check.mockImplementation(() => (state.dirty ? 1 : 0))
  state.save.mockResolvedValue(true)
  state.keepOpen.mockImplementation(() => {
    state.group = { ...state.group, previewId: undefined }
    state.listeners.forEach((listener) => listener())
  })
})
afterEach(cleanup)

describe('preview editor tabs', () => {
  it('marks a preview accessibly and keeps it open on double-click without reopening or closing it', () => {
    state.dirty = false
    state.group.previewId = 'file'
    render(tabs())
    const tab = screen.getByRole('tab', { name: 'Document.md, contextmenu.editor_tab.preview' })
    expect(tab.querySelector('.italic')?.textContent).toBe('Document.md')
    fireEvent.click(tab)
    expect(state.open).toHaveBeenCalledExactlyOnceWith('group', 'file')
    expect(state.keepOpen).not.toHaveBeenCalled()

    fireEvent.doubleClick(tab)
    expect(state.keepOpen).toHaveBeenCalledExactlyOnceWith('group', 'file')
    expect(state.open).toHaveBeenCalledOnce()
    expect(state.close).not.toHaveBeenCalled()

    expect(screen.getByRole('tab', { name: 'Document.md' }).querySelector('.italic')).toBeNull()
  })

  it('binds the Keep Open context action to the clicked group and file', () => {
    state.dirty = false
    state.group.previewId = 'file'
    render(tabs())
    fireEvent.contextMenu(screen.getByRole('tab'))
    const menu = state.menu.mock.calls[0][0] as Parameters<typeof showContextMenu>[0]
    const action = menu.items.find((item) => 'value' in item && item.value === 'keep_open')
    expect(action).toMatchObject({ label: 'contextmenu.editor_tab.keep_open', commandId: 'app_keepEditorOpen' })
    act(() => { if (action && 'handler' in action) action.handler?.() })
    expect(state.keepOpen).toHaveBeenCalledExactlyOnceWith('group', 'file')

    fireEvent.contextMenu(screen.getByRole('tab'))
    const keptMenu = state.menu.mock.calls[1][0] as Parameters<typeof showContextMenu>[0]
    expect(keptMenu.items.some((item) => 'value' in item && item.value === 'keep_open')).toBe(false)
  })
})

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

describe('editor tab keyboard boundaries', () => {
  beforeEach(() => {
    state.dirty = false
    state.group = { id: 'group', activeId: 'file', opened: ['file', 'other'], previewId: undefined }
  })
  afterEach(() => {
    state.group = { id: 'group', activeId: 'file', opened: ['file'], previewId: undefined }
  })

  it.each([
    { ctrlKey: true },
    { metaKey: true },
    { altKey: true },
    { shiftKey: true },
    { isComposing: true },
    { keyCode: 229 },
  ])('does not switch documents for reserved keyboard input %j', (options) => {
    render(tabs())
    const tab = screen.getAllByRole('tab')[0]
    tab.focus()
    const event = new KeyboardEvent('keydown', {
      key: 'ArrowRight', bubbles: true, cancelable: true, ...options,
    })
    fireEvent(tab, event)
    expect(state.open).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(tab)
    expect(event.defaultPrevented).toBe(false)
  })

  it('retains ordinary arrow navigation and focuses the next document tab', () => {
    render(tabs())
    const [first, second] = screen.getAllByRole('tab')
    first.focus()
    fireEvent.keyDown(first, { key: 'ArrowRight' })
    expect(state.open).toHaveBeenCalledExactlyOnceWith('group', 'other')
    expect(document.activeElement).toBe(second)
  })
})

describe('editor tab wheel boundaries', () => {
  function overflowingTabs() {
    const { container } = render(tabs())
    const list = container.querySelector<HTMLElement>('.tab-items')!
    Object.defineProperties(list, {
      scrollWidth: { configurable: true, value: 500 },
      clientWidth: { configurable: true, value: 200 },
    })
    return list
  }

  it('leaves Ctrl-wheel zoom gestures untouched', () => {
    const list = overflowingTabs()
    const event = new WheelEvent('wheel', {
      deltaY: 40, ctrlKey: true, bubbles: true, cancelable: true,
    })
    // happy-dom's WheelEvent extends UIEvent and omits MouseEvent modifiers.
    Object.defineProperty(event, 'ctrlKey', { value: true })
    fireEvent(list, event)
    expect(list.scrollLeft).toBe(0)
    expect(event.defaultPrevented).toBe(false)
  })

  it.each([
    { deltaX: 0, deltaY: 40, deltaMode: 0, expected: 40 },
    { deltaX: 60, deltaY: 10, deltaMode: 0, expected: 60 },
    { deltaX: 0, deltaY: 2, deltaMode: 1, expected: 32 },
    { deltaX: 0, deltaY: 1, deltaMode: 2, expected: 200 },
  ])('retains ordinary overflow scrolling %j', ({ expected, ...deltas }) => {
    const list = overflowingTabs()
    const event = new WheelEvent('wheel', { ...deltas, bubbles: true, cancelable: true })
    fireEvent(list, event)
    expect(list.scrollLeft).toBe(expected)
    expect(event.defaultPrevented).toBe(true)
  })
})

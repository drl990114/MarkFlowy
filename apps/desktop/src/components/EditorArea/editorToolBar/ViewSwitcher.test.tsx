import { TooltipProvider } from '@/components/ui/tooltip'
import { EditorViewType, type EditorViewTypeValue } from '@/constants/editorViewType'
import bus from '@/helper/eventBus'
import type { IShowContextMenuParams } from '@/stores/useContextMenuStore'
import useEditorViewTypeStore from '@/stores/useEditorViewTypeStore'
import { desktopDarkTheme } from '@markflowy/theme'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { enableMapSet } from 'immer'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PreviewToolbar } from './PreviewToolbar/PreviewToolbar'
import { SourceCodeToolbar } from './SourceCodeToolbar/SourceCodeToolbar'
import { WysiwygToolbar } from './WysiwygToolbar/WysiwygToolbar'
import { ViewSwitcher } from './WysiwygToolbar/components/ViewSwitcher'

const mocks = vi.hoisted(() => ({
  showMenu: vi.fn<(params: IShowContextMenuParams) => void>(),
  supportedModes: ['wysiwyg', 'sourceCode', 'preview'],
  editor: { getUiState: () => null, subscribeUiState: () => () => {} },
}))

vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@/helper/eventBus', () => ({ default: { emit: vi.fn() } }))
vi.mock('@/helper/files', () => ({ getFileObject: (id: string) => ({ id, name: `${id}.md` }) }))
vi.mock('@/stores', () => ({
  useEditorStore: (selector: (state: { activeId: string }) => unknown) =>
    selector({ activeId: 'other' }),
}))
vi.mock('@/stores/useFileTypeConfigStore', () => ({
  default: {
    getState: () => ({
      getFileTypeConfigById: () => ({ supportedModes: mocks.supportedModes }),
    }),
  },
}))
vi.mock('@/components/ui-v2/ContextMenu', () => ({ showContextMenu: mocks.showMenu }))
vi.mock('../capricornEditorRegistry', () => ({
  getCapricornEditor: () => mocks.editor,
  subscribeCapricornEditors: () => () => {},
}))
vi.mock('../sourceCodeEditorRegistry', () => ({ sourceCodeCodemirrorViewMap: new Map() }))
vi.mock('../sourceInsertCommands', () => ({ insertSourceImage: vi.fn(), insertSourceLink: vi.fn() }))
vi.mock('./components/MenuList', () => ({ MenuList: () => <button type='button'>More</button> }))

enableMapSet()
beforeEach(() => {
  vi.clearAllMocks()
  mocks.supportedModes = ['wysiwyg', 'sourceCode', 'preview']
  useEditorViewTypeStore.setState({ editorViewTypeMap: new Map() })
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function withProviders(children: React.ReactNode) {
  return (
    <ThemeProvider theme={desktopDarkTheme}>
      <TooltipProvider>{children}</TooltipProvider>
    </ThemeProvider>
  )
}

describe('editor view switcher', () => {
  it('offers supported modes for its pane and retains that target when a menu item is selected', () => {
    useEditorViewTypeStore.getState().setEditorViewType('pane', EditorViewType.SOURCECODE)
    mocks.supportedModes = ['wysiwyg', 'sourceCode']
    render(withProviders(<ViewSwitcher editorId='pane' groupId='right' />))

    fireEvent.click(screen.getByRole('button', { name: 'view.label: view.source_code' }))
    const items = mocks.showMenu.mock.calls.at(-1)![0].items
    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({ value: EditorViewType.SOURCECODE, checked: true })
    expect(items[1]).toMatchObject({ value: EditorViewType.WYSIWYG, checked: false })
    if ('type' in items[1]) throw new Error('Expected a view menu item')
    items[1].handler?.()
    expect(bus.emit).toHaveBeenCalledWith('editor_toggle_type', undefined, EditorViewType.WYSIWYG, {
      editorId: 'pane',
      groupId: 'right',
    })
  })

  it('updates the button label when its document mode changes', () => {
    render(withProviders(<ViewSwitcher editorId='pane' groupId='right' />))
    expect(screen.getByRole('button', { name: 'view.label: view.wysiwyg' })).toBeDefined()
    act(() => useEditorViewTypeStore.getState().setEditorViewType('pane', EditorViewType.PREVIEW))
    expect(screen.getByRole('button', { name: 'view.label: view.preview' })).toBeDefined()
  })

  it.each([
    [EditorViewType.WYSIWYG, 'view.wysiwyg', WysiwygToolbar],
    [EditorViewType.SOURCECODE, 'view.source_code', SourceCodeToolbar],
    [EditorViewType.PREVIEW, 'view.preview', PreviewToolbar],
  ] as const)('keeps the %s switcher visible when the toolbar is narrower than its common controls', async (mode, label, Toolbar) => {
    useEditorViewTypeStore.getState().setEditorViewType('pane', mode as EditorViewTypeValue)
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() =>
      DOMRect.fromRect({ width: 40, height: 32 }),
    )
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return this.dataset.sectionId === 'common' ? 48 : 90
    })
    const { container } = render(withProviders(<Toolbar editorId='pane' groupId='right' />))
    const button = screen.getByRole('button', { name: `view.label: ${label}` })
    const common = button.closest('[data-section-id="common"]')!

    if (mode !== EditorViewType.PREVIEW) {
      await waitFor(() => expect(getComputedStyle(container.querySelector('[data-section-id="history"]')!).display).toBe('none'))
    }
    expect(getComputedStyle(common).display).not.toBe('none')
    expect(common.firstElementChild).toBe(button)
    fireEvent.click(button)
    expect(mocks.showMenu).toHaveBeenCalledOnce()
  })
})

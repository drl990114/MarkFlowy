import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { IFile } from '@/helper/filesys'
import type { IShowContextMenuParams } from '@/stores/useContextMenuStore'
import { fileSaveCoordinator } from '../../fileSaveCoordinator'
import { DEFAULT_TEXT_METADATA } from '../../textFileFormat'
import { MenuList } from './MenuList'
import useFileTextDirectionStore, { getFileTextDirectionKey } from '@/stores/useFileTextDirectionStore'
import { writeSettingData } from '@/services/app-setting'

const mocks = vi.hoisted(() => ({
  showMenu: vi.fn<(params: IShowContextMenuParams) => void>(),
  save: vi.fn(),
  files: {
    pane: { id: 'pane', name: 'pane.md', path: '/pane.md', kind: 'file', ext: 'md' },
    other: { id: 'other', name: 'other.md', path: '/other.md', kind: 'file', ext: 'md' },
    image: { id: 'image', name: 'photo.png', path: '/photo.png', kind: 'file', ext: 'png' },
    start: { id: 'start', name: 'New tab', kind: 'new_tab' },
    draft: { id: 'draft', name: 'Untitled.md', kind: 'file', ext: 'md' },
  } as Record<string, Partial<IFile>>,
}))

vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@/commands', () => ({ commandRegistry: { execute: vi.fn() } }))
vi.mock('@/components/LocalHistory/historyDialogStore', () => ({ openLocalHistory: vi.fn() }))
vi.mock('@/components/ui-v2/ContextMenu', () => ({ showContextMenu: mocks.showMenu }))
vi.mock('@/helper/eventBus', () => ({ default: { emit: vi.fn() } }))
vi.mock('@/helper/files', () => ({
  default: (selector: (state: { entries: typeof mocks.files }) => unknown) =>
    selector({ entries: mocks.files }),
  getFileObject: (id: string) => mocks.files[id],
}))
vi.mock('@/stores', () => ({
  useEditorStore: (
    selector: (state: { activeId: string; getEditorContent: () => string }) => unknown,
  ) => selector({ activeId: 'other', getEditorContent: () => '' }),
  useEditorStateStore: (selector: (state: { idStateMap: Map<string, unknown> }) => unknown) =>
    selector({ idStateMap: new Map() }),
}))
vi.mock('@/stores/useAppSettingStore', () => ({
  default: (selector: (state: { settingData: Record<string, unknown> }) => unknown) =>
    selector({ settingData: {} }),
}))
vi.mock('@/stores/useEditorViewTypeStore', () => ({
  default: (selector: (state: { editorViewTypeMap: Map<string, string> }) => unknown) =>
    selector({ editorViewTypeMap: new Map() }),
}))
vi.mock('@/stores/useFileTypeConfigStore', () => ({
  default: {
    getState: () => ({
      getFileTypeConfigById: (id: string) => ({
        type: id === 'image' ? 'image' : 'markdown',
        supportedModes: ['wysiwyg', 'sourceCode', 'preview'],
      }),
    }),
  },
}))
vi.mock('@/extensions/bookmarks/useBookMarksStore', () => ({
  default: { getState: () => ({ findMark: () => undefined }) },
}))
vi.mock('@/services/app-setting', () => ({ writeSettingData: vi.fn() }))
vi.mock('@/services/dialog', () => ({ dialog: { info: vi.fn() } }))
vi.mock('@/services/text-file-format', () => ({
  previewFileEncoding: vi.fn(),
  applyEncodingPreview: vi.fn(),
  saveFileWithFormat: mocks.save,
}))
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue({ size: '1 KB', last_modified: '' }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  useFileTextDirectionStore.setState({ directions: {} })
  mocks.save.mockResolvedValue(true)
  fileSaveCoordinator.loadSnapshot('pane', {
    content: 'text',
    revision: 'disk',
    status: 'success',
    text: { ...DEFAULT_TEXT_METADATA, format: { encoding: 'gbk', bom: 'none' } },
  })
})
afterEach(cleanup)

function openMenu(editorId: string, value = 'text_encoding') {
  render(
    <TooltipProvider>
      <MenuList editorId={editorId} />
    </TooltipProvider>,
  )
  fireEvent.click(screen.getByRole('button', { name: 'action.more' }))
  return mocks.showMenu.mock.calls.at(-1)![0].items.find(
    (item) => 'value' in item && item.value === value,
  )
}

describe('toolbar file encoding', () => {
  it('shows and saves the toolbar document encoding when another pane is globally active', async () => {
    const item = openMenu('pane')
    expect(item).toMatchObject({ label: 'text_encoding.label · GBK' })

    act(() => {
      if (item && 'handler' in item) item.handler?.()
    })
    expect(screen.getByRole('dialog', { name: 'text_encoding.label' })).toBeTruthy()
    expect(screen.getByText(/pane\.md · GBK/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'text_encoding.save_with_encoding' }))

    await waitFor(() =>
      expect(mocks.save).toHaveBeenCalledWith('pane', {
        encoding: 'gbk',
        bom: 'none',
      }),
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it.each(['image', 'start'])('omits encoding actions for a non-text tab: %s', (editorId) => {
    expect(openMenu(editorId)).toBeUndefined()
  })
})

describe('toolbar file text direction', () => {
  function choices() {
    const item = mocks.showMenu.mock.calls.at(-1)![0].items.find(
      (entry) => 'value' in entry && entry.value === 'text_direction',
    )
    if (!item || !('children' in item) || !item.children) throw new Error('Direction submenu missing')
    return item.children.filter((entry) => 'value' in entry)
  }
  function select(value: string) {
    const choice = choices().find((entry) => entry.value === value)
    expect(choice).toBeDefined()
    act(() => choice?.handler?.())
    fireEvent.click(screen.getByRole('button', { name: 'action.more' }))
    expect(choices().filter((entry) => entry.checked).map((entry) => entry.value)).toEqual([value])
  }

  it('sets only the toolbar file, marks one choice and restores inheritance without writing global settings', () => {
    expect(openMenu('pane', 'text_direction')).toBeDefined()
    expect(choices().map((entry) => entry.value)).toEqual(['inherit', 'auto', 'ltr', 'rtl'])
    expect(choices().find((entry) => entry.value === 'inherit')?.checked).toBe(true)
    for (const direction of ['rtl', 'ltr', 'auto']) {
      select(direction)
      expect(useFileTextDirectionStore.getState().directions).toEqual({ 'path:/pane.md': direction })
    }
    select('inherit')
    expect(useFileTextDirectionStore.getState().directions).toEqual({})
    expect(writeSettingData).not.toHaveBeenCalled()
  })

  it('supports an unsaved Markdown file', () => {
    expect(openMenu('draft', 'text_direction')).toBeDefined()
    select('rtl')
    expect(useFileTextDirectionStore.getState().directions[getFileTextDirectionKey('draft')]).toBe('rtl')
    expect(useFileTextDirectionStore.getState().directions['path:/other.md']).toBeUndefined()
  })

  it.each(['image', 'start'])('omits body direction for non-Markdown content: %s', (editorId) => {
    expect(openMenu(editorId, 'text_direction')).toBeUndefined()
  })
})

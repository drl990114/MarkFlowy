import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { IFile } from '@/helper/filesys'
import type { IShowContextMenuParams } from '@/stores/useContextMenuStore'
import { fileSaveCoordinator } from '../../fileSaveCoordinator'
import { DEFAULT_TEXT_METADATA } from '../../textFileFormat'
import { MenuList } from './MenuList'

const mocks = vi.hoisted(() => ({
  showMenu: vi.fn<(params: IShowContextMenuParams) => void>(),
  save: vi.fn(),
  files: {
    pane: { id: 'pane', name: 'pane.md', path: '/pane.md', kind: 'file', ext: 'md' },
    other: { id: 'other', name: 'other.md', path: '/other.md', kind: 'file', ext: 'md' },
    image: { id: 'image', name: 'photo.png', path: '/photo.png', kind: 'file', ext: 'png' },
    start: { id: 'start', name: 'New tab', kind: 'new_tab' },
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
  mocks.save.mockResolvedValue(true)
  fileSaveCoordinator.loadSnapshot('pane', {
    content: 'text',
    revision: 'disk',
    status: 'success',
    text: { ...DEFAULT_TEXT_METADATA, format: { encoding: 'gbk', bom: 'none' } },
  })
})
afterEach(cleanup)

function openMenu(editorId: string) {
  render(
    <TooltipProvider>
      <MenuList editorId={editorId} />
    </TooltipProvider>,
  )
  fireEvent.click(screen.getByRole('button', { name: 'action.more' }))
  return mocks.showMenu.mock.calls.at(-1)![0].items.find(
    (item) => 'value' in item && item.value === 'text_encoding',
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

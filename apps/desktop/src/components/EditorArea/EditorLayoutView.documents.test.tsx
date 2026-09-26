import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { desktopLightTheme } from '@markflowy/theme'
import { enableMapSet } from 'immer'
import type { PropsWithChildren } from 'react'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { DocumentTitle } from '@/components/TitleBar/DocumentTitle'
import { createFile } from '@/helper/filesys'
import useEditorStore from '@/stores/useEditorStore'
import useEditorStateStore from '@/stores/useEditorStateStore'
import EditorAreaContent from './EditorAreaContent'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(), isTauri: () => false }))
vi.mock('@/hooks', () => ({ useGlobalOSInfo: () => ({ osType: 'macos' }) }))
vi.mock('@/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  t: (key: string) => key,
  i18n: { t: (key: string) => key },
}))
vi.mock('react-resizable-panels', () => {
  const Box = ({ children, className }: PropsWithChildren<{ className?: string }>) => (
    <div className={className}>{children}</div>
  )
  return { Group: Box, Panel: Box, Separator: () => null }
})
vi.mock('./Editor', () => ({
  default: ({ id, visible }: { id: string; visible: boolean }) => (
    <textarea aria-label={`Editor ${id}`} hidden={!visible} />
  ),
}))
vi.mock('./EditorAreaTabs', () => ({ default: () => <div role='tablist' /> }))
vi.mock('./ExternalFileChangeAlert', () => ({ ExternalFileChangeAlert: () => null }))
vi.mock('./EmptyState', () => ({ EmptyState: () => null }))
vi.mock('./editorToolBar/FindReplace', () => ({ FindReplace: () => null }))
vi.mock('./editorToolBar/PreviewToolbar/PreviewToolbar', () => ({ PreviewToolbar: () => null }))
vi.mock('./editorToolBar/SourceCodeToolbar/SourceCodeToolbar', () => ({
  SourceCodeToolbar: () => null,
}))
vi.mock('./editorToolBar/WysiwygToolbar', () => ({ WysiwygToolbar: () => null }))
vi.mock('@/components/LocalHistory/DraftProtectionStatus', () => ({
  DraftProtectionStatus: () => <button type='button'>Draft protection retry</button>,
}))

enableMapSet()
beforeEach(() => {
  useEditorStore.getState().setFolderData(null)
  useEditorStateStore.setState({ idStateMap: new Map() })
  createFile({ id: 'document', name: 'My note.md', path: '/notes/My note.md' })
  useEditorStore
    .getState()
    .setEditorLayout(
      { type: 'leaf', id: 'group', opened: ['document'], activeId: 'document' },
      'group',
    )
})
afterEach(cleanup)

function renderDocument() {
  render(
    <ThemeProvider theme={desktopLightTheme}>
      <TooltipProvider>
        <DocumentTitle />
        <EditorAreaContent />
      </TooltipProvider>
    </ThemeProvider>,
  )
}

it('keeps the live editor, selection and scroll when its folder is attached and closed', () => {
  renderDocument()
  expect(screen.queryByRole('tablist')).toBeNull()
  const editor = screen.getByRole('textbox') as HTMLTextAreaElement
  fireEvent.change(editor, { target: { value: 'Unsaved writing' } })
  editor.focus()
  editor.setSelectionRange(3, 8)
  editor.scrollTop = 120
  act(() => useEditorStateStore.getState().setIdStateMap('document', { hasUnsavedChanges: true }))
  expect(screen.getByText('My note.md •')).toBeTruthy()

  act(() =>
    useEditorStore
      .getState()
      .setFolderDataPure([{ id: 'folder', name: 'notes', path: '/notes', kind: 'dir' }]),
  )
  expect(screen.getByRole('tablist')).toBeTruthy()
  expect(screen.getByRole('textbox')).toBe(editor)
  act(() => useEditorStore.getState().setFolderDataPure(null))
  expect(screen.queryByRole('tablist')).toBeNull()
  expect(screen.getByRole('textbox')).toBe(editor)
  expect(editor.value).toBe('Unsaved writing')
  expect([editor.selectionStart, editor.selectionEnd, editor.scrollTop]).toEqual([3, 8, 120])
  expect(document.activeElement).toBe(editor)
  expect(screen.getByRole('region', { name: 'My note.md' })).toBeTruthy()
})

it('keeps named actions when tabs are hidden and reveals tabs for the second document', async () => {
  renderDocument()
  expect(screen.getByRole('button', { name: 'Draft protection retry' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'common.close' })).toBeTruthy()
  const newDocument = screen.getByRole('button', { name: 'file.newTab' })
  newDocument.focus()
  expect(document.activeElement).toBe(newDocument)
  await act(async () => fireEvent.click(newDocument))
  expect(screen.getByRole('tablist')).toBeTruthy()
  expect(useEditorStore.getState().opened).toHaveLength(2)
  expect(useEditorStore.getState().getRootPath()).toBeUndefined()
})

it('reveals tabs in each group after using the compact split action', async () => {
  renderDocument()
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: /app_splitEditorRight/ })),
  )
  expect(useEditorStore.getState().editorLayout.type).toBe('branch')
  expect(screen.getAllByRole('tablist')).toHaveLength(2)
})

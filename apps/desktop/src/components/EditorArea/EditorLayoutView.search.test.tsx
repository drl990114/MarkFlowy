import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { enableMapSet } from 'immer'
import { desktopLightTheme } from '@markflowy/theme'
import { ThemeProvider } from 'styled-components'
import { StrictMode, type PropsWithChildren } from 'react'
import type { MfCodemirrorView } from 'rme'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { commandRegistry } from '@/commands'
import { TooltipProvider } from '@/components/ui/tooltip'
import { EditorViewType } from '@/constants/editorViewType'
import useEditorStore from '@/stores/useEditorStore'
import useEditorViewTypeStore from '@/stores/useEditorViewTypeStore'
import EditorAreaContent from './EditorAreaContent'
import { closeEditorSearch, useEditorSearchStore } from './editorSearchStore'
import { getSourceCodeFind, setSourceCodeEditor } from './sourceCodeEditorRegistry'

vi.mock('@/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  t: (key: string) => key,
}))
vi.mock('react-resizable-panels', () => {
  const Box = ({ children, className }: PropsWithChildren<{ className?: string }>) => (
    <div className={className}>{children}</div>
  )
  return { Group: Box, Panel: Box, Separator: () => null }
})
vi.mock('./Editor', () => ({
  default: ({ id }: { id: string }) => <div data-editor-marker={id} />,
}))
vi.mock('./EditorAreaTabs', () => ({
  default: ({ groupId }: { groupId: string }) => (
    <div className='editor-area-tabs' data-tab-group={groupId} />
  ),
}))
vi.mock('./EditorGroupToolbar', () => ({ default: () => null }))
vi.mock('./ExternalFileChangeAlert', () => ({ ExternalFileChangeAlert: () => null }))
vi.mock('./EmptyState', () => ({ EmptyState: () => null }))

enableMapSet()
const originalEditorState = useEditorStore.getState()
const originalViewState = useEditorViewTypeStore.getState()
const originalSearchState = useEditorSearchStore.getState()
const sources = new Map<string, MfCodemirrorView>()

beforeEach(() => {
  useEditorStore.getState().setEditorLayout(
    {
      type: 'branch',
      id: 'root',
      direction: 'horizontal',
      sizes: [50, 50],
      children: [
        { type: 'leaf', id: 'left', opened: ['first'], activeId: 'first' },
        { type: 'leaf', id: 'right', opened: ['second'], activeId: 'second' },
      ],
    },
    'left',
  )
  useEditorViewTypeStore.getState().setEditorViewType('first', EditorViewType.SOURCECODE)
  useEditorViewTypeStore.getState().setEditorViewType('second', EditorViewType.SOURCECODE)
})

afterEach(() => {
  cleanup()
  closeEditorSearch()
  sources.forEach((source, id) => {
    setSourceCodeEditor(id, undefined)
    source.cm.destroy()
  })
  sources.clear()
  useEditorStore.setState(originalEditorState, true)
  useEditorViewTypeStore.setState(originalViewState, true)
  useEditorSearchStore.setState(originalSearchState, true)
})

function registerSource(id: string, doc: string) {
  const cm = new EditorView({
    state: EditorState.create({ doc }),
    parent: document.querySelector(`[data-editor-marker='${id}']`)!,
  })
  const source = { cm, setSearchState: vi.fn() } as unknown as MfCodemirrorView
  sources.set(id, source)
  act(() => setSourceCodeEditor(id, source))
  return { cm, find: getSourceCodeFind(source)! }
}

it('keeps one find bar below the active tabs and transfers search and commands across split panes in StrictMode', async () => {
  render(
    <StrictMode>
      <ThemeProvider theme={desktopLightTheme}>
        <TooltipProvider>
          <EditorAreaContent />
        </TooltipProvider>
      </ThemeProvider>
    </StrictMode>,
  )
  const first = registerSource('first', 'foo foo')
  const second = registerSource('second', 'foo')
  const firstSearch = vi.spyOn(first.find, 'searchAsync')

  await act(async () => {
    await commandRegistry.execute('app_findReplaceEditor')
  })
  const input = screen.getByRole('textbox', { name: 'find_replace.find' })
  expect(document.activeElement).toBe(input)
  expect(
    input
      .closest('[data-slot="editor-find"]')
      ?.previousElementSibling?.getAttribute('data-tab-group'),
  ).toBe('left')
  fireEvent.change(input, { target: { value: 'foo' } })
  await waitFor(() => expect(first.find.getState().matches).toHaveLength(2))
  expect(second.find.getState().matches).toHaveLength(0)

  act(() => second.cm.focus())
  expect(useEditorStore.getState().activeGroupId).toBe('right')
  const movedInput = screen.getByRole('textbox', { name: 'find_replace.find' }) as HTMLInputElement
  expect(movedInput.value).toBe('foo')
  expect(
    movedInput
      .closest('[data-slot="editor-find"]')
      ?.previousElementSibling?.getAttribute('data-tab-group'),
  ).toBe('right')
  expect(screen.getAllByRole('textbox', { name: 'find_replace.find' })).toHaveLength(1)
  expect(second.cm.hasFocus).toBe(true)
  await waitFor(() => expect(second.find.getState().matches).toHaveLength(1))
  expect(first.find.getState().matches).toHaveLength(0)
  expect(firstSearch).toHaveBeenCalledOnce()

  await act(async () => {
    await commandRegistry.execute('app_findReplaceEditor')
  })
  expect(document.activeElement).toBe(movedInput)
  expect(movedInput.value).toBe('foo')

  await act(async () => {
    await commandRegistry.execute('app_stopFindEditor')
  })
  expect(screen.queryByRole('textbox', { name: 'find_replace.find' })).toBeNull()
  expect(second.cm.hasFocus).toBe(true)
  expect(second.find.getState().matches).toHaveLength(0)

  act(() => first.cm.focus())
  await act(async () => {
    await commandRegistry.execute('app_findReplaceEditor')
  })
  const reopenedInput = screen.getByRole('textbox', {
    name: 'find_replace.find',
  }) as HTMLInputElement
  expect(reopenedInput.value).toBe('foo')
  expect(document.activeElement).toBe(reopenedInput)
  await waitFor(() => expect(first.find.getState().matches).toHaveLength(2))
  fireEvent.keyDown(reopenedInput, { key: 'Escape' })
  expect(useEditorSearchStore.getState().owner).toBeNull()
  expect(first.cm.hasFocus).toBe(true)
})

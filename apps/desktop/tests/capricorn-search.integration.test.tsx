import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { enableMapSet } from 'immer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import { ThemeProvider } from 'styled-components'
import { desktopDarkTheme } from '@markflowy/theme'
import { createCapricornRuntime } from 'virtual:markflowy-capricorn-runtime'
import { TooltipProvider } from '@/components/ui/tooltip'
import { FindReplace } from '@/components/EditorArea/editorToolBar/FindReplace/find-replace'
import {
  createCapricornRuntimeAdapter,
  type CapricornRuntimeAdapter,
  type CapricornRuntimeFactory,
} from '@/components/EditorArea/capricornRuntimeAdapter'
import { setCapricornEditor } from '@/components/EditorArea/capricornEditorRegistry'
import {
  openDocumentSearch,
  requestSearchNavigation,
  useEditorSearchStore,
  closeEditorSearch,
} from '@/components/EditorArea/editorSearchStore'
import { createFindShortcutHandler } from '@/helper/findShortcut'
import useEditorStore from '@/stores/useEditorStore'
import useEditorViewTypeStore from '@/stores/useEditorViewTypeStore'
import { EditorViewType, isCapricornRuntimeAvailable } from '@/constants/editorViewType'
import { Search } from '@/extensions/search'
import useSearchStore from '@/extensions/search/useSearchStore'
import useFileCacheStore from '@/helper/files'
import { createFile } from '@/helper/filesys'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 30,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        key: index,
        start: index * 30,
        size: 30,
      })),
    scrollToIndex: vi.fn(),
  }),
}))
vi.mock('@/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  t: (key: string) => key,
}))
enableMapSet()

const adapters: CapricornRuntimeAdapter[] = []
const changes = vi.fn()
const initialEditorState = useEditorStore.getState()
const initialCacheState = useFileCacheStore.getState()
const initialSearchState = useSearchStore.getState()
const escapedListLine =
  '- [tauri](https://tauri.app/) \\- Build smaller\\, faster\\, and more secure desktop apps with a web frontend\\.'

async function create(markdown: string, fileId = 'first', virtualize = false) {
  const container = document.createElement('div')
  if (virtualize) {
    Object.defineProperties(container, {
      clientHeight: { value: 800 },
      clientWidth: { value: 1000 },
    })
    container.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      bottom: 800,
      right: 1000,
      height: 800,
      width: 1000,
      toJSON() {},
    })
  }
  document.body.append(container)
  let adapter!: CapricornRuntimeAdapter
  await act(async () => {
    adapter = createCapricornRuntimeAdapter({
      container,
      createRuntime: createCapricornRuntime as CapricornRuntimeFactory,
      onChange: changes,
      options: {
        markdown,
        mode: 'edit',
        autoFocus: false,
        getScrollableContainer: () => container,
        virtualize: { enable: virtualize, firstPaintBlockSize: 20, bufferRange: 200 },
      },
    })
  })
  adapters.push(adapter)
  act(() => {
    useEditorViewTypeStore.getState().setEditorViewType(fileId, EditorViewType.WYSIWYG)
    setCapricornEditor(fileId, adapter)
  })
  return { adapter, container }
}

afterEach(async () => {
  cleanup()
  await act(async () => {
    closeEditorSearch()
    setCapricornEditor('first', undefined)
    setCapricornEditor('second', undefined)
    adapters.splice(0).forEach((adapter) => adapter.destroy())
  })
  useEditorSearchStore.setState({
    owner: null,
    navigation: null,
    query: '',
    replacement: '',
    caseSensitive: false,
    composing: false,
    error: null,
  })
  document.body.replaceChildren()
  changes.mockClear()
  useEditorStore.setState(initialEditorState, true)
  useFileCacheStore.setState(initialCacheState, true)
  useSearchStore.setState(initialSearchState, true)
  vi.mocked(invoke).mockReset()
  vi.restoreAllMocks()
})

function mountFind() {
  act(() => {
    useEditorStore.setState({ activeId: 'first', activeGroupId: 'main' })
  })
  return render(
    <StrictMode>
      <TooltipProvider>
        <FindReplace />
      </TooltipProvider>
    </StrictMode>,
  )
}

describe.skipIf(!isCapricornRuntimeAvailable)(
  `Desktop Capricorn search integration (${__MARKFLOWY_CAPRICORN_RUNTIME_VERSION__})`,
  () => {
    it('focuses one host find panel, preserves the query on repeated Mod+F, and keeps IME drafts out of search', async () => {
      const { adapter, container } = await create('foo foo\n\nlast foo')
      mountFind()
      const shortcut = createFindShortcutHandler('Ctrl-f', openDocumentSearch)
      window.addEventListener('keydown', shortcut, true)
      try {
        const target = container.querySelector('textarea') ?? container
        fireEvent.keyDown(target, { key: 'f', ctrlKey: true })
        const input = await screen.findByRole('textbox', { name: 'find_replace.find' })
        expect(document.activeElement).toBe(input)
        fireEvent.change(input, { target: { value: 'foo' } })
        await waitFor(() => expect(adapter.find.getState().matches).toHaveLength(3))
        fireEvent.keyDown(target, { key: 'f', ctrlKey: true })
        expect(screen.getAllByRole('textbox', { name: 'find_replace.find' })).toHaveLength(1)
        expect((input as HTMLInputElement).value).toBe('foo')
        expect(document.activeElement).toBe(input)
        fireEvent.compositionStart(input)
        fireEvent.change(input, { target: { value: '中文' } })
        await new Promise((resolve) => setTimeout(resolve, 150))
        expect(adapter.find.getState().query).toBe('foo')
        fireEvent.compositionEnd(input)
        await waitFor(() => expect(adapter.find.getState().query).toBe('中文'))
        fireEvent.keyDown(input, { key: 'Escape' })
        expect(screen.queryByRole('textbox', { name: 'find_replace.find' })).toBeNull()
        expect(adapter.getUiState().canUndo).toBe(false)
        expect(changes.mock.calls.some(([event]) => event?.documentChanged === true)).toBe(false)
      } finally {
        window.removeEventListener('keydown', shortcut, true)
      }
    })

    it('waits for an unopened editor, reveals the requested occurrence once, and transfers ownership to document find', async () => {
      useEditorViewTypeStore.getState().setEditorViewType('first', EditorViewType.WYSIWYG)
      mountFind()
      const lineText = '[foo](https://foo.test "foo") foo'
      const startColumn = lineText.lastIndexOf('foo')
      act(() =>
        requestSearchNavigation({
          fileId: 'first',
          path: '/first.md',
          line: 1,
          query: 'foo',
          lineText,
          startColumn,
          endColumn: startColumn + 3,
        }),
      )
      const { adapter, container } = await create(lineText)
      await waitFor(() =>
        expect(
          container.querySelector('[data-cap-find-match][data-active="true"]')?.textContent,
        ).toBe('foo'),
      )
      expect(adapter.find.getState().matches).toHaveLength(1)
      expect(screen.queryByRole('textbox', { name: 'find_replace.find' })).toBeNull()
      const selected = adapter.find.getState().matches[0] as {
        start: { key: string; offset: number }
      }
      expect(selected.start.offset).toBe(1)
      act(() => {
        useEditorSearchStore.setState({ query: 'foo' })
        openDocumentSearch()
      })
      await waitFor(() => expect(adapter.find.getState().matches).toHaveLength(2))
      expect(document.activeElement).toBe(
        screen.getByRole('textbox', { name: 'find_replace.find' }),
      )
      const matches = adapter.find.getState().matches
      await act(async () => {
        await adapter.find.navigateTo!(1)
      })
      expect(adapter.find.getState().matches).toBe(matches)
      expect(adapter.find.getState()).toBe(adapter.find.getState())
    })

    it('keeps hidden-address navigation in WYSIWYG and rejects stale results', async () => {
      const lineText = '[visible](https://hidden.test)'
      const { adapter, container } = await create(lineText)
      let result: unknown
      await act(async () => {
        result = await adapter.find.revealSourceMatch!({
          line: 1,
          query: 'hidden',
          lineText,
          startColumn: 18,
          endColumn: 24,
        })
      })
      expect(result).toMatchObject({ status: 'block' })
      expect(container.querySelector('[data-cap-source-match="true"]')).not.toBeNull()
      await act(async () => {
        adapter.setMarkdown('changed')
      })
      expect(
        await adapter.find.revealSourceMatch!({
          line: 1,
          query: 'hidden',
          lineText,
          startColumn: 18,
          endColumn: 24,
        }),
      ).toMatchObject({ status: 'stale' })
    })

    it('restores the visible highlight when file B changes to its active instance after cross-file navigation', async () => {
      await create('file A foo', 'first')
      const background = await create('file B foo foo', 'second')
      mountFind()
      act(() => {
        useEditorStore.setState({ activeId: 'second' })
        requestSearchNavigation({
          fileId: 'second',
          path: '/second.md',
          line: 1,
          query: 'foo',
          lineText: 'file B foo foo',
          startColumn: 11,
          endColumn: 14,
        })
      })
      await waitFor(() =>
        expect(
          background.container.querySelector('[data-cap-find-match][data-active="true"]')
            ?.textContent,
        ).toBe('foo'),
      )
      background.container.hidden = true
      const active = await create('file B foo foo', 'second')
      await waitFor(() =>
        expect(
          active.container.querySelector('[data-cap-find-match][data-active="true"]')?.textContent,
        ).toBe('foo'),
      )
      const match = active.adapter.find.getState().matches[0] as { start: { offset: number } }
      expect(match.start.offset).toBe(11)
      expect(background.adapter.find.getState().matches).toHaveLength(0)
      expect(useEditorSearchStore.getState().error).toBeNull()
    })

    it.each([
      { virtualize: false, escaped: false },
      { virtualize: true, escaped: false },
      { virtualize: false, escaped: true },
      { virtualize: true, escaped: true },
    ])(
      'highlights a partial word after a link in file B (virtualize: $virtualize, escaped: $escaped)',
      async ({ virtualize, escaped }) => {
        const first = await create('- Desktop', 'first', virtualize)
        mountFind()
        const firstTarget = {
          fileId: 'first',
          path: '/first.md',
          line: 1,
          query: 'desk',
          lineText: '- Desktop',
          startColumn: 2,
          endColumn: 6,
        }
        act(() => requestSearchNavigation(firstTarget))
        await waitFor(() =>
          expect(
            first.container.querySelector('[data-cap-find-match][data-active="true"]')?.textContent,
          ).toBe('Desk'),
        )
        const lineText = escaped ? escapedListLine : escapedListLine.replaceAll('\\', '')
        const markdown = [
          ...Array.from({ length: 133 }, (_, index) =>
            index % 2 === 0 ? `Paragraph ${index}` : '',
          ),
          '## Special Thanks',
          '',
          '- [rino](https://github.com/ocavue/rino) by [ocavue](https://github.com/ocavue) - The initial version of the editor in this project was developed based on rino.',
          '- [remirror](https://remirror.io/) - A powerful ProseMirror-based rich text editor framework.',
          lineText,
          '- And thanks to all the open source libraries and projects that MarkFlowy depends on.',
        ].join('\n')
        const { adapter, container } = await create(markdown, 'second', virtualize)
        const secondTarget = {
          fileId: 'second',
          path: '/second.md',
          line: 138,
          query: 'desk',
          lineText,
          startColumn: lineText.indexOf('desk'),
          endColumn: lineText.indexOf('desk') + 4,
        }
        act(() => {
          useEditorStore.setState({ activeId: 'second' })
          requestSearchNavigation(secondTarget)
        })
        await waitFor(() => expect(adapter.find.getState().matches).toHaveLength(1))
        await waitFor(() =>
          expect(
            container.querySelector('[data-cap-find-match][data-active="true"]')?.textContent,
          ).toBe('desk'),
        )
        expect(useEditorSearchStore.getState().error).toBeNull()
        act(() => {
          useEditorStore.setState({ activeId: 'first' })
          requestSearchNavigation(firstTarget)
        })
        await waitFor(() => expect(adapter.find.getState().matches).toHaveLength(0))
        act(() => {
          useEditorStore.setState({ activeId: 'second' })
          requestSearchNavigation(secondTarget)
        })
        await waitFor(() =>
          expect(
            container.querySelector('[data-cap-find-match][data-active="true"]')?.textContent,
          ).toBe('desk'),
        )
        if (virtualize)
          expect(container.querySelectorAll('[data-cap-leaf-block]').length).toBeLessThan(40)
      },
    )

    it.each([false, true])(
      'retains the visible match after real global-result clicks A → B → A → B (B already open: %s)',
      async (alreadyOpen) => {
        // happy-dom otherwise measures every warmed block as zero height,
        // making the whole document fit into the virtual viewport.
        const getRect = HTMLElement.prototype.getBoundingClientRect
        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
          this: HTMLElement,
        ) {
          return this.hasAttribute('data-cap-leaf-block')
            ? new DOMRect(0, 0, 1000, 40)
            : getRect.call(this)
        })
        createFile({ id: 'first', path: '/workspace/a.md', name: 'a.md', content: '- Desktop' })
        const markdown = `${'Paragraph\n\n'.repeat(68)}## Special Thanks\n${escapedListLine}`
        createFile({ id: 'second', path: '/workspace/b.md', name: 'b.md', content: markdown })
        const first = await create('- Desktop', 'first', true)
        let second = alreadyOpen ? await create(markdown, 'second', true) : undefined
        act(() => {
          useEditorStore.getState().setEditorLayout(
            {
              type: 'leaf',
              id: 'main',
              opened: alreadyOpen ? ['first', 'second'] : ['first'],
              activeId: 'first',
            },
            'main',
          )
          useEditorStore.setState({
            folderData: [{ id: 'root', path: '/workspace', name: 'workspace', kind: 'dir' }],
          })
          useSearchStore.setState({ searchKeyword: 'desk' })
        })
        vi.mocked(invoke).mockResolvedValue({
          data: [
            {
              id: 'a',
              path: '/workspace/a.md',
              name: 'a.md',
              ext: 'md',
              is_folder: false,
              relative_path: 'a.md',
              matches: [{ id: 'a-line', line: 1, content: '- Desktop' }],
            },
            {
              id: 'b',
              path: '/workspace/b.md',
              name: 'b.md',
              ext: 'md',
              is_folder: false,
              relative_path: 'b.md',
              matches: [{ id: 'b-line', line: 138, content: escapedListLine }],
            },
          ],
        })
        render(
          <StrictMode>
            <ThemeProvider theme={desktopDarkTheme}>
              <TooltipProvider>
                {Search.components}
                <FindReplace />
              </TooltipProvider>
            </ThemeProvider>
          </StrictMode>,
        )
        fireEvent.click(screen.getByRole('button', { name: 'search.text' }))
        await waitFor(() => expect(document.querySelectorAll('button.search-info')).toHaveLength(2))
        const resultButtons = document.querySelectorAll<HTMLButtonElement>('button.search-info')
        const activeText = (container: HTMLElement) =>
          container.querySelector('[data-cap-find-match][data-active="true"]')?.textContent
        fireEvent.click(resultButtons[0])
        await waitFor(() => expect(activeText(first.container)).toBe('Desk'))
        fireEvent.click(resultButtons[1])
        expect(useEditorSearchStore.getState().navigation).toMatchObject({
          fileId: 'second',
          line: 138,
          startColumn: 74,
          endColumn: 78,
          lineText: escapedListLine,
        })
        if (!second) second = await create(markdown, 'second', true)
        const target = second
        await waitFor(() => expect(activeText(target.container)).toBe('desk'))
        fireEvent.click(resultButtons[0])
        await waitFor(() => expect(activeText(first.container)).toBe('Desk'))
        expect(target.adapter.find.getState().matches).toHaveLength(0)
        fireEvent.click(resultButtons[1])
        await waitFor(() => expect(activeText(target.container)).toBe('desk'))
        expect(useEditorSearchStore.getState().error).toBeNull()
        await waitFor(() =>
          expect(target.container.querySelectorAll('[data-cap-leaf-block]').length).toBeLessThan(
            40,
          ),
        )
        expect(changes.mock.calls.some(([event]) => event?.documentChanged === true)).toBe(false)
      },
    )

    it.each(['js', 'mermaid', 'html', 'math'])(
      'reveals the source of a %s block without stealing query input focus',
      async (language) => {
        const lineText = language === 'mermaid' ? 'graph TD; foo-->foo' : 'foo foo'
        const markdown =
          language === 'math' ? `$$\n${lineText}\n$$` : `\`\`\`${language}\n${lineText}\n\`\`\``
        const { adapter, container } = await create(markdown)
        mountFind()
        act(() => openDocumentSearch())
        const input = await screen.findByRole('textbox', { name: 'find_replace.find' })
        const startColumn = lineText.lastIndexOf('foo')
        await act(async () => {
          await adapter.find.revealSourceMatch!({
            line: 2,
            lineText,
            query: 'foo',
            startColumn,
            endColumn: startColumn + 3,
          })
        })
        await waitFor(() =>
          expect(container.querySelector('.cm-searchMatch-selected')).not.toBeNull(),
        )
        expect(document.activeElement).toBe(input)
      },
    )

    it('refreshes document find after replacing a selected occurrence and undoing it', async () => {
      const { adapter } = await create('foo foo')
      mountFind()
      act(() => openDocumentSearch())
      fireEvent.change(await screen.findByRole('textbox', { name: 'find_replace.find' }), {
        target: { value: 'foo' },
      })
      await waitFor(() => expect(adapter.find.getState().matches).toHaveLength(2))
      await act(async () => {
        await adapter.find.navigateTo!(1)
        await adapter.find.replace('bar')
      })
      expect(adapter.getMarkdown().trim()).toBe('foo bar')
      await act(async () => adapter.commands.undo())
      await waitFor(() => expect(adapter.find.getState().matches).toHaveLength(2))
      expect(adapter.getMarkdown().trim()).toBe('foo foo')
    })
  },
)

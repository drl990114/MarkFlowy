import { act } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCapricornRuntime } from 'virtual:markflowy-capricorn-runtime'
import { isCapricornRuntimeAvailable } from '@/constants/capricornRuntime'
import { createCapricornExportSurface, type CapricornExportSurface } from './capricornExportSurface'
import {
  capricornClipboardCommands,
  createCapricornKeybindingConfiguration,
} from './capricornKeybindings'
import {
  createCapricornRuntimeAdapter,
  type CapricornRuntimeAdapter,
  type CapricornRuntimeFactory,
  type CapricornRuntimeSession,
} from './capricornRuntimeAdapter'
import { getCapricornRuntimeInput } from './capricornRuntimeDom'

const createRuntime = createCapricornRuntime as CapricornRuntimeFactory
const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
let session: CapricornRuntimeSession | undefined
let adapter: CapricornRuntimeAdapter | undefined
let surface: CapricornExportSurface | undefined

afterEach(async () => {
  await act(async () => {
    surface?.dispose()
    adapter?.destroy()
    session?.destroy()
  })
  surface = undefined
  adapter = undefined
  session = undefined
  document.body.replaceChildren()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function container() {
  const element = document.createElement('div')
  document.body.append(element)
  return element
}

describe.skipIf(!isCapricornRuntimeAvailable)('published runtime host compatibility', () => {
  it('keeps the document usable and applies typography when saved shortcuts are unsupported', async () => {
    const source = container()
    const onError = vi.fn()
    const keybindingConfiguration = createCapricornKeybindingConfiguration(
      { toggleH2: 'mod-ArrowUp' },
      true,
    )
    await act(async () => {
      adapter = createCapricornRuntimeAdapter({
        container: source,
        createRuntime,
        onChange: vi.fn(),
        options: { markdown: 'Still editable', keybindingConfiguration, onError },
      })
    })
    expect(adapter!.getMarkdown()).toBe('Still editable')
    expect(onError).toHaveBeenCalledOnce()
    await act(async () =>
      adapter!.updateSettings({ keybindingConfiguration, style: { fontSize: 24 } }),
    )
    expect(source.querySelector<HTMLElement>('[data-cap-content]')!.style.fontSize).toBe('24px')
    await act(async () => adapter!.commands.setBlockType('heading-2'))
    expect(adapter!.getMarkdown()).toBe('## Still editable')
  })
  it.each([
    ['windows', 'Win32', 'Windows NT 10.0', 'win32'],
    ['linux', 'Linux x86_64', 'X11; Linux x86_64', 'linux'],
    ['mac', 'MacIntel', 'Mac OS X', 'darwin'],
  ])(
    'applies, updates and disables user shortcuts on %s without resetting history',
    async (_platform, platform, userAgent, nodePlatform) => {
      vi.spyOn(navigator, 'platform', 'get').mockReturnValue(platform)
      vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent)
      vi.stubGlobal('process', { ...process, platform: nodePlatform })
      const source = container()
      const keymap = { toggleH2: 'mod-Alt-2', undo: 'mod-z', redo: 'mod-Shift-z' }
      await act(async () => {
        session = createRuntime(source, {
          markdown: 'Body',
          commands: capricornClipboardCommands,
          keybindingConfiguration: createCapricornKeybindingConfiguration(keymap, true),
        })
        session.focus()
        await frame()
      })
      const press = async (key: string, altKey = false) => {
        const event = new KeyboardEvent('keydown', {
          key,
          code: key === 'z' ? 'KeyZ' : `Digit${key}`,
          altKey,
          ctrlKey: _platform !== 'mac',
          metaKey: _platform === 'mac',
          bubbles: true,
          cancelable: true,
        })
        await act(async () => {
          getCapricornRuntimeInput(source)!.dispatchEvent(event)
          await frame()
        })
        return event
      }
      await press('2')
      expect(session!.getMarkdown()).toBe('Body')
      expect((await press('2', true)).defaultPrevented).toBe(true)
      expect(session!.getMarkdown()).toBe('## Body')
      const state = session!.getUiState()
      await act(async () =>
        session!.updateSettings({
          keybindingConfiguration: createCapricornKeybindingConfiguration(
            { ...keymap, toggleH2: '' },
            true,
          ),
        }),
      )
      expect(session!.getUiState().canUndo).toBe(state.canUndo)
      await press('z')
      expect(session!.getMarkdown()).toBe('Body')
      await press('2', true)
      await press('2')
      expect(session!.getMarkdown()).toBe('Body')
    },
  )

  it('exports all paragraphs while retaining the virtualized live editor and its focus', async () => {
    const source = container()
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      return {
        top: 0,
        bottom: this === source ? 600 : 24,
        width: 800,
        height: this === source ? 600 : 24,
      } as DOMRect
    })
    const markdown = Array.from({ length: 300 }, (_, index) => `Paragraph ${index} end`).join(
      '\n\n',
    )
    await act(async () => {
      session = createRuntime(source, {
        markdown,
        virtualize: { enable: true, firstPaintBlockSize: 3, bufferRange: 0 },
        getScrollableContainer: () => source,
      })
      session.focus()
      await frame()
    })
    expect(source.textContent).not.toContain('Paragraph 299 end')
    const input = getCapricornRuntimeInput(source)
    expect(document.activeElement).toBe(input)
    await act(async () => {
      surface = await createCapricornExportSurface({
        source,
        markdown,
        options: { colorScheme: 'dark', style: { fontFamily: 'serif', fontSize: 24 } },
        loadRuntime: async () => createRuntime,
      })
    })
    expect(surface!.element.textContent).toContain('Paragraph 299 end')
    expect(surface!.element.querySelectorAll('p')).toHaveLength(300)
    expect(surface!.element.querySelector<HTMLElement>('[data-cap-content]')!.style.fontSize).toBe(
      '24px',
    )
    expect(document.activeElement).toBe(input)
    expect(session!.getMarkdown()).toBe(markdown)
    expect(session!.getUiState().canUndo).toBe(false)
    const element = surface!.element
    await act(async () => surface!.dispose())
    expect(element.isConnected).toBe(false)
    expect(source.isConnected).toBe(true)
  })

  it('resolves an unmounted heading from a visible paragraph after a scroll jump', async () => {
    const source = container()
    const markdown = [
      '# First',
      ...Array(100).fill('First section'),
      '# Second',
      ...Array(100).fill('Second section'),
      '# Third',
      ...Array(100).fill('Third section'),
    ].join('\n\n')
    await act(async () => {
      adapter = createCapricornRuntimeAdapter({
        container: source,
        createRuntime,
        onChange: vi.fn(),
        options: { markdown, virtualize: { enable: false } },
      })
    })
    const headings = adapter!.headings.getAll()
    const documentNode = source.querySelector('[data-cap-editable][data-cap-key]')!
    const blocks = Array.from(documentNode.children)
    // Simulate the runtime's virtual window after a scrollbar jump: only
    // paragraphs deep in section two remain, with both heading DOM nodes gone.
    const anchor = blocks[150]
    expect(anchor.textContent).toContain('Second section')
    documentNode.replaceChildren(anchor)
    vi.spyOn(anchor, 'getBoundingClientRect').mockReturnValue({ top: -10, bottom: 40 } as DOMRect)
    vi.spyOn(source, 'getBoundingClientRect').mockReturnValue({ top: 0, bottom: 600 } as DOMRect)
    const readHeadings = vi.spyOn(adapter!.headings, 'getAll')
    const exportMarkdown = vi.spyOn(adapter!, 'getMarkdown')
    expect(adapter!.getActiveHeadingId!(headings, source)).toBe(headings[1].id)
    expect(readHeadings).not.toHaveBeenCalled()
    expect(exportMarkdown).not.toHaveBeenCalled()
    // Restore the React-owned DOM before destroying the runtime.
    documentNode.replaceChildren(...blocks)
  })
})

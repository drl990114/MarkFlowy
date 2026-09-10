import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { commandRegistry } from '@/commands'
import { EVENT } from '@/constants'
import useEditorStore from '@/stores/useEditorStore'
import useAppSettingStore from '@/stores/useAppSettingStore'
import { QuickOpenDialog } from './QuickOpenDialog'
import type * as QuickOpenFilesModule from './quickOpenFiles'
import {
  getOpenedQuickOpenFiles,
  loadQuickOpenFiles,
  openQuickOpenFile,
  type QuickOpenFile,
} from './quickOpenFiles'

const focus = vi.hoisted(() => ({ scheduleActiveEditorFocus: vi.fn() }))
vi.mock('@/components/EditorArea/focusActiveEditor', () => focus)
vi.mock('@/helper/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn() } }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('zens', () => ({ toast: { error: vi.fn() } }))
vi.mock('@/i18n', () => ({
  useTranslation: () => ({ t: translate }),
}))
vi.mock('./quickOpenFiles', async (importOriginal) => {
  const original = await importOriginal<typeof QuickOpenFilesModule>()
  return {
    ...original,
    getOpenedQuickOpenFiles: vi.fn(() => []),
    loadQuickOpenFiles: vi.fn(),
    openQuickOpenFile: vi.fn(),
  }
})

function translate(key: string) {
  return key
}
function file(relativePath: string): QuickOpenFile {
  return {
    id: `path:/workspace/${relativePath}`,
    name: relativePath.split('/').pop()!,
    path: `/workspace/${relativePath}`,
    relativePath,
    ext: 'md',
  }
}
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const reactEnvironment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
beforeAll(() => {
  reactEnvironment.IS_REACT_ACT_ENVIRONMENT = true
})
afterAll(() => {
  delete reactEnvironment.IS_REACT_ACT_ENVIRONMENT
})

describe('Quick Open dialog', () => {
  let root: Root
  let container: HTMLDivElement
  let origin: HTMLButtonElement

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getOpenedQuickOpenFiles).mockReturnValue([])
    vi.mocked(loadQuickOpenFiles).mockResolvedValue([file('alpha.md'), file('docs/beta.md')])
    vi.mocked(openQuickOpenFile).mockImplementation((entry) => ({
      id: entry.id,
      name: entry.name,
      kind: 'file',
    }))
    useEditorStore.setState({
      folderData: [{ id: 'root', kind: 'dir', name: 'workspace', path: '/workspace' }],
    })
    useAppSettingStore.setState({ settingData: { file_exclude_patterns: '*.tmp' } })
    origin = document.createElement('button')
    document.body.append(origin)
    origin.focus()
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    act(() => root.render(<QuickOpenDialog />))
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    // Radix restores focus in a timer after unmount; drain it before the next
    // test resets spies and mounts another dialog.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    container.remove()
    origin.remove()
  })

  async function open() {
    await act(async () => {
      await commandRegistry.execute(EVENT.app_quickOpen)
    })
  }
  function input() {
    return document.querySelector<HTMLInputElement>('[cmdk-input]')!
  }
  async function type(value: string) {
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
      setter.call(input(), value)
      input().dispatchEvent(new Event('input', { bubbles: true }))
    })
  }
  async function key(keyName: string, isComposing = false) {
    await act(async () => {
      input().dispatchEvent(
        new KeyboardEvent('keydown', {
          key: keyName,
          isComposing,
          bubbles: true,
          cancelable: true,
        }),
      )
    })
  }
  function names() {
    return [...document.querySelectorAll('[cmdk-item]:not([hidden])')].map(
      (item) => item.textContent,
    )
  }

  it('focuses the input, navigates with arrows and opens with Enter', async () => {
    await open()
    expect(document.activeElement).toBe(input())
    expect(loadQuickOpenFiles).toHaveBeenCalledExactlyOnceWith('/workspace', '*.tmp')
    await key('ArrowDown')
    await key('Enter')
    expect(openQuickOpenFile).toHaveBeenCalledWith(file('docs/beta.md'))
    expect(document.querySelector('[data-mf-quick-open]')).toBeNull()
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(focus.scheduleActiveEditorFocus).toHaveBeenCalledOnce()
  })

  it('searches relative paths locally and Enter selects the current query', async () => {
    await open()
    await key('ArrowDown')
    await type('alpha')
    expect(names()).toEqual(['alpha.md'])
    await type('docs/beta')
    expect(names()).toEqual(['beta.mddocs/beta.md'])
    expect(loadQuickOpenFiles).toHaveBeenCalledOnce()
    await key('Enter')
    expect(openQuickOpenFile).toHaveBeenCalledWith(file('docs/beta.md'))
  })

  it('allows a pointer to open a result', async () => {
    await open()
    await act(async () => document.querySelector<HTMLElement>('[cmdk-item]')!.click())
    expect(openQuickOpenFile).toHaveBeenCalledWith(file('alpha.md'))
  })

  it('ignores IME confirmation and restores the original focus on Escape', async () => {
    await open()
    await key('Enter', true)
    await key('Escape', true)
    expect(openQuickOpenFile).not.toHaveBeenCalled()
    expect(input()).not.toBeNull()
    await key('Escape')
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(document.querySelector('[data-mf-quick-open]')).toBeNull()
    expect(document.activeElement).toBe(origin)
    expect(focus.scheduleActiveEditorFocus).not.toHaveBeenCalled()
  })

  it('keeps all matches reachable when the first batch is full', async () => {
    vi.mocked(loadQuickOpenFiles).mockResolvedValue(
      Array.from({ length: 105 }, (_, i) => file(`note-${String(i).padStart(3, '0')}.md`)),
    )
    await open()
    expect(names()).toHaveLength(101)
    await key('End')
    await key('Enter')
    expect(names()).toHaveLength(105)
    expect(openQuickOpenFile).not.toHaveBeenCalled()
    await key('Enter')
    expect(openQuickOpenFile).toHaveBeenCalledWith(file('note-100.md'))
  })

  it('shows loading, failure with retry, and an empty result state', async () => {
    const scan = deferred<QuickOpenFile[]>()
    vi.mocked(loadQuickOpenFiles).mockReturnValueOnce(scan.promise)
    await open()
    expect(document.querySelector('[role="status"]')?.textContent).toContain('quick_open.loading')
    await act(async () => scan.reject(new Error('scan failed')))
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('quick_open.load_error')
    vi.mocked(loadQuickOpenFiles).mockResolvedValueOnce([])
    await act(async () =>
      document.querySelector<HTMLButtonElement>('[role="alert"] button')!.click(),
    )
    expect(document.querySelector('[cmdk-empty]')?.textContent).toBe('quick_open.empty')
  })

  it('drops late results after closing or switching workspaces', async () => {
    const scan = deferred<QuickOpenFile[]>()
    vi.mocked(loadQuickOpenFiles).mockReturnValueOnce(scan.promise)
    await open()
    await key('Escape')
    await open()
    await act(async () => scan.resolve([file('stale.md')]))
    expect(names().join()).not.toContain('stale.md')

    const secondScan = deferred<QuickOpenFile[]>()
    vi.mocked(loadQuickOpenFiles).mockReturnValueOnce(secondScan.promise)
    await act(async () =>
      useEditorStore.setState({
        folderData: [{ id: 'next', name: 'next', kind: 'dir', path: '/next' }],
      }),
    )
    expect(names()).toEqual([])
    vi.mocked(loadQuickOpenFiles).mockResolvedValueOnce([file('latest.md')])
    await act(async () =>
      useEditorStore.setState({
        folderData: [{ id: 'latest', name: 'latest', kind: 'dir', path: '/latest' }],
      }),
    )
    await act(async () => secondScan.resolve([file('stale-next.md')]))
    expect(names().join()).not.toContain('stale-next.md')
    expect(names().join()).toContain('latest.md')
  })

  it('shows opened files without a workspace and refocuses without rescanning', async () => {
    await act(async () => useEditorStore.setState({ folderData: [] }))
    vi.mocked(getOpenedQuickOpenFiles).mockReturnValue([file('opened.md')])
    await open()
    await type('opened')
    await open()
    expect(input().selectionStart).toBe(0)
    expect(input().selectionEnd).toBe(6)
    expect(loadQuickOpenFiles).not.toHaveBeenCalled()
    expect(names().join()).toContain('opened.md')
  })

  it('does not open the selected file when Enter activates the retry button', async () => {
    vi.mocked(getOpenedQuickOpenFiles).mockReturnValue([file('opened.md')])
    vi.mocked(loadQuickOpenFiles).mockRejectedValueOnce(new Error('scan failed'))
    await open()
    const retryButton = document.querySelector<HTMLButtonElement>('[role="alert"] button')!
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    await act(async () => {
      retryButton.focus()
      retryButton.dispatchEvent(enter)
    })
    expect(enter.defaultPrevented).toBe(false)
    expect(openQuickOpenFile).not.toHaveBeenCalled()
    await act(async () => retryButton.click())
    expect(loadQuickOpenFiles).toHaveBeenCalledTimes(2)
    expect(document.activeElement).toBe(input())
  })

  it('explains the empty state when no workspace or document is open', async () => {
    await act(async () => useEditorStore.setState({ folderData: [] }))
    await open()
    expect(document.querySelector('[cmdk-empty]')?.textContent).toBe('quick_open.no_workspace')
    expect(loadQuickOpenFiles).not.toHaveBeenCalled()
  })
})

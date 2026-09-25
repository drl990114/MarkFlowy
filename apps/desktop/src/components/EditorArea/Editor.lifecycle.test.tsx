import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { enableMapSet } from 'immer'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EditorViewType } from '@/constants/editorViewType'
import useFileCacheStore, { delSaveOpenedEditorEntries, getSaveOpenedEditorEntries, setFileObject, setSaveOpenedEditorEntries } from '@/helper/files'
import { registerDraftRecovery } from '@/services/draftRecoveryState'
import type { FileTypeConfig } from '@/helper/fileTypeHandler'
import useEditorViewTypeStore from '@/stores/useEditorViewTypeStore'
import useFileTypeConfigStore from '@/stores/useFileTypeConfigStore'
import Editor from './Editor'

enableMapSet()

const harness = vi.hoisted(() => ({
  events: [] as string[],
  onLoadingChange: undefined as undefined | ((pending: boolean) => void),
  getFileTypeConfig: vi.fn(),
  preload: vi.fn(),
  recordStage: vi.fn(),
}))

vi.mock('@/helper/fileTypeHandler', () => ({
  getFileTypeConfig: harness.getFileTypeConfig,
  isTextfileType: (config: FileTypeConfig) =>
    config.type === 'markdown' || config.type === 'json' || config.type === 'text',
  isSupportedMode: (config: FileTypeConfig, mode: string) => config.supportedModes.includes(mode as typeof config.defaultMode),
}))
vi.mock('@/helper/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}))
vi.mock('@/services/editor-file', () => ({ isEmptyEditor: () => false }))
vi.mock('@/i18n', () => ({ t: (key: string) => key }))
vi.mock('./capricornRuntimeAdapter', () => ({
  preloadCapricornRuntimeFactory: harness.preload,
}))
vi.mock('./editorPerformanceDiagnostics', () => ({
  finishEditorOpenMeasurement: vi.fn(),
  getEditorOpenMeasurement: () => ({ id: 'measurement' }),
  recordEditorOpenStage: harness.recordStage,
}))
vi.mock('./focusActiveEditor', () => ({
  isEditorPanelBlankTarget: () => false,
  scheduleActiveEditorFocus: vi.fn(),
}))
vi.mock('overlayscrollbars-react', () => ({
  OverlayScrollbarsComponent: ({ children }: { children?: ReactNode }) => <>{children}</>,
}))
vi.mock('./styles', () => ({
  EditorScrollContainer: ({ children, ...props }: { children?: ReactNode }) => (
    <div {...props}>{children}</div>
  ),
}))
vi.mock('./TextEditor', () => ({
  default: ({ onLoadingChange }: { onLoadingChange?: (pending: boolean) => void }) => {
    harness.onLoadingChange = onLoadingChange
    harness.events.push('text-editor-render')
    return <div data-testid='text-editor' />
  },
}))
vi.mock('./preview/PreviewContent', () => ({ PreviewContent: () => null }))
vi.mock('./EmptyState', () => ({ EmptyState: () => null }))
vi.mock('./UnsupportedFileType', () => ({ UnsupportedFileType: () => null }))

const markdownConfig: FileTypeConfig = {
  type: 'markdown',
  supportedModes: [EditorViewType.WYSIWYG, EditorViewType.SOURCECODE, EditorViewType.PREVIEW],
  defaultMode: EditorViewType.WYSIWYG,
}

function deferred<T>() {
  let resolve: (value: T) => void = () => {}
  const promise = new Promise<T>((onResolve) => {
    resolve = onResolve
  })
  return { promise, resolve }
}

beforeEach(() => {
  harness.events.length = 0
  harness.getFileTypeConfig.mockReset()
  harness.preload.mockReset()
  harness.recordStage.mockReset()
  useFileCacheStore.setState({ entries: {}, metadataRevision: 0, pathEntries: {} })
  useFileTypeConfigStore.setState({ fileTypeConfigMap: new Map() })
  useEditorViewTypeStore.setState({ editorViewTypeMap: new Map() })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('Editor initialization lifecycle', () => {
  it('keeps a failed draft gated and allows retry without mounting an empty editor', async () => {
    setFileObject('retry-draft', { id: 'retry-draft', name: 'draft.md', kind: 'file' })
    useFileTypeConfigStore.getState().setFileTypeConfig('retry-draft', markdownConfig)
    harness.getFileTypeConfig.mockResolvedValue(markdownConfig)
    let failing = true
    const release = registerDraftRecovery('retry-draft', async () => {
      if (failing) throw new Error('body unavailable')
      setFileObject('retry-draft', { id: 'retry-draft', name: 'draft.md', kind: 'file', content: 'protected' })
      release()
    })
    try {
      const view = render(<Editor id='retry-draft' active visible />)
      await view.findByRole('alert')
      expect(view.queryByTestId('text-editor')).toBeNull()
      expect(harness.getFileTypeConfig).not.toHaveBeenCalled()
      failing = false
      fireEvent.click(view.getByRole('button', { name: 'common.retry' }))
      await view.findByTestId('text-editor')
      expect(view.queryByRole('alert')).toBeNull()
    } finally { release() }
  })
  it('opens a restored source-only Markdown view without preparing Capricorn', async () => {
    setFileObject('source', { id: 'source', name: 'source.md', kind: 'file', content: '# Source' })
    useEditorViewTypeStore.getState().setEditorViewType('source', EditorViewType.SOURCECODE)
    harness.getFileTypeConfig.mockResolvedValue(markdownConfig)
    const view = render(<Editor id='source' active visible />)
    await view.findByTestId('text-editor')
    expect(harness.preload).not.toHaveBeenCalled()
    expect(useEditorViewTypeStore.getState().getEditorViewType('source')).toBe(EditorViewType.SOURCECODE)
  })
  it('gates an already-known file type on draft validation and promotes a newly visible tab', async () => {
    setFileObject('recovering', { id: 'recovering', name: 'draft.md', kind: 'file', content: 'draft' })
    useFileTypeConfigStore.getState().setFileTypeConfig('recovering', markdownConfig)
    harness.getFileTypeConfig.mockResolvedValue(markdownConfig)
    const promote = vi.fn()
    const ready = registerDraftRecovery('recovering', promote)
    try {
      const view = render(<Editor id='recovering' active visible />)
      expect(view.queryByTestId('text-editor')).toBeNull()
      expect(promote).toHaveBeenCalledWith('foreground')
      expect(harness.getFileTypeConfig).not.toHaveBeenCalled()
      await act(async () => ready())
      await view.findByTestId('text-editor')
    } finally {
      ready()
    }
  })

  it('mounts an unvisited hidden tab for an explicit save without displaying or activating it', async () => {
    setFileObject('save-hidden', { id: 'save-hidden', name: 'draft.md', kind: 'file', content: 'draft' })
    harness.getFileTypeConfig.mockResolvedValue(markdownConfig)
    const view = render(<Editor id='save-hidden' active={false} visible={false} />)
    expect(harness.getFileTypeConfig).not.toHaveBeenCalled()
    let saved!: Promise<boolean>
    await act(async () => { saved = getSaveOpenedEditorEntries('save-hidden')!() })
    await view.findByTestId('text-editor')
    expect(view.container.querySelector<HTMLElement>('[data-editor-active="false"]')?.style.display).toBe('none')
    const save = vi.fn(async () => true)
    setSaveOpenedEditorEntries('save-hidden', save)
    await expect(saved).resolves.toBe(true)
    expect(save).toHaveBeenCalledOnce()
    delSaveOpenedEditorEntries('save-hidden')
  })

  it('does no content work for an unvisited restored tab and keeps its selected mode', async () => {
    harness.getFileTypeConfig.mockResolvedValue(markdownConfig)
    harness.preload.mockResolvedValue(undefined)
    setFileObject('file-a', {
      id: 'file-a', name: 'a.md', kind: 'file', ext: 'md', path: '/workspace/a.md',
    })
    useEditorViewTypeStore.getState().setEditorViewType('file-a', EditorViewType.SOURCECODE)
    const view = render(<Editor id='file-a' active={false} visible={false} groupId='group' />)
    expect(view.container.childElementCount).toBe(0)
    expect(harness.getFileTypeConfig).not.toHaveBeenCalled()
    expect(harness.preload).not.toHaveBeenCalled()

    view.rerender(<Editor id='file-a' active visible groupId='group' />)
    await view.findByTestId('text-editor')
    expect(harness.getFileTypeConfig).toHaveBeenCalledOnce()
    expect(useEditorViewTypeStore.getState().editorViewTypeMap.get('file-a')).toBe(EditorViewType.SOURCECODE)
  })

  it('does not publish type state, prewarm, or diagnostics after the tab closes', async () => {
    const pending = deferred<FileTypeConfig>()
    harness.getFileTypeConfig.mockReturnValueOnce(pending.promise)
    setFileObject('file-a', {
      id: 'file-a',
      name: 'a.md',
      kind: 'file',
      ext: 'md',
      path: '/workspace/a.md',
    })

    const view = render(<Editor id='file-a' active visible groupId='group' />)
    expect(harness.getFileTypeConfig).toHaveBeenCalledOnce()
    view.unmount()
    await act(async () => pending.resolve(markdownConfig))

    expect(useFileTypeConfigStore.getState().fileTypeConfigMap.has('file-a')).toBe(false)
    expect(useEditorViewTypeStore.getState().editorViewTypeMap.has('file-a')).toBe(false)
    expect(harness.preload).not.toHaveBeenCalled()
    expect(harness.recordStage).not.toHaveBeenCalled()
  })

  it('ignores an obsolete A result after switching to B', async () => {
    const pendingA = deferred<FileTypeConfig>()
    harness.getFileTypeConfig.mockImplementation((file: { id: string }) =>
      file.id === 'file-a' ? pendingA.promise : Promise.resolve(markdownConfig),
    )
    setFileObject('file-a', {
      id: 'file-a',
      name: 'a.md',
      kind: 'file',
      ext: 'md',
      path: '/workspace/a.md',
    })
    setFileObject('file-b', {
      id: 'file-b',
      name: 'b.md',
      kind: 'file',
      ext: 'md',
      path: '/workspace/b.md',
    })

    const view = render(<Editor id='file-a' active visible groupId='group' />)
    view.rerender(<Editor id='file-b' active visible groupId='group' />)
    await waitFor(() => {
      expect(useFileTypeConfigStore.getState().fileTypeConfigMap.get('file-b')).toEqual(
        markdownConfig,
      )
    })
    await act(async () => pendingA.resolve(markdownConfig))

    expect(useFileTypeConfigStore.getState().fileTypeConfigMap.has('file-a')).toBe(false)
    expect(useEditorViewTypeStore.getState().editorViewTypeMap.has('file-a')).toBe(false)
    expect(useEditorViewTypeStore.getState().editorViewTypeMap.get('file-b')).toBe(
      EditorViewType.WYSIWYG,
    )
    expect(harness.preload).toHaveBeenCalledOnce()
  })

  it('starts prewarm before mounting TextEditor and does not await it before disk loading', async () => {
    const pendingPrewarm = deferred<void>()
    harness.getFileTypeConfig.mockResolvedValue(markdownConfig)
    harness.preload.mockImplementation(() => {
      harness.events.push('prewarm')
      return pendingPrewarm.promise
    })
    setFileObject('file-a', {
      id: 'file-a',
      name: 'a.md',
      kind: 'file',
      ext: 'md',
      path: '/workspace/a.md',
    })

    const view = render(<Editor id='file-a' active visible groupId='group' />)
    await view.findByTestId('text-editor')

    expect(harness.events[0]).toBe('prewarm')
    expect(harness.events).toContain('text-editor-render')
    expect(harness.preload).toHaveBeenCalledOnce()
    await act(async () => pendingPrewarm.resolve())
  })

  it('keeps one deadline from type lookup through content preparation and stops on failure', async () => {
    vi.useFakeTimers()
    const pendingType = deferred<FileTypeConfig>()
    harness.getFileTypeConfig.mockReturnValue(pendingType.promise)
    harness.preload.mockResolvedValue(undefined)
    setFileObject('file-a', {
      id: 'file-a',
      name: 'a.md',
      kind: 'file',
      ext: 'md',
      path: '/workspace/a.md',
    })
    const view = render(<Editor id='file-a' active visible groupId='group' />)
    act(() => vi.advanceTimersByTime(500))
    expect(view.queryByRole('progressbar')).toBeNull()
    await act(async () => pendingType.resolve(markdownConfig))
    act(() => harness.onLoadingChange?.(true))
    act(() => vi.advanceTimersByTime(300))
    expect(view.queryByRole('progressbar')).not.toBeNull()
    act(() => harness.onLoadingChange?.(false))
    expect(view.queryByRole('progressbar')).toBeNull()
    expect(view.container.querySelector('[aria-busy="true"]')).toBeNull()
    act(() => harness.onLoadingChange?.(true))
    act(() => vi.advanceTimersByTime(799))
    expect(view.queryByRole('progressbar')).toBeNull()
    act(() => vi.advanceTimersByTime(1))
    expect(view.queryByRole('progressbar')).not.toBeNull()
  })

  it('keeps the mounted tab subtree across A to B to A visibility switches', async () => {
    harness.getFileTypeConfig.mockResolvedValue(markdownConfig)
    harness.preload.mockResolvedValue(undefined)
    setFileObject('file-a', {
      id: 'file-a',
      name: 'a.md',
      kind: 'file',
      ext: 'md',
      path: '/workspace/a.md',
    })

    const view = render(<Editor id='file-a' active visible groupId='group' />)
    const mountedEditor = await view.findByTestId('text-editor')
    view.rerender(<Editor id='file-a' active={false} visible={false} groupId='group' />)
    expect(view.getByTestId('text-editor')).toBe(mountedEditor)
    expect(
      (mountedEditor.closest('[data-editor-id="file-a"]') as HTMLElement | null)?.style.display,
    ).toBe('none')

    view.rerender(<Editor id='file-a' active visible groupId='group' />)
    expect(view.getByTestId('text-editor')).toBe(mountedEditor)
    expect(
      (mountedEditor.closest('[data-editor-id="file-a"]') as HTMLElement | null)?.style.display,
    ).toBe('')
    expect(harness.getFileTypeConfig).toHaveBeenCalledOnce()
    expect(harness.preload).toHaveBeenCalledOnce()
  })
})

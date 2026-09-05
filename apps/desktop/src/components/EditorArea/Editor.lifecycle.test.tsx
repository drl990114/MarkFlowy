import { act, cleanup, render, waitFor } from '@testing-library/react'
import { enableMapSet } from 'immer'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EditorViewType } from '@/constants/editorViewType'
import useFileCacheStore, { setFileObject } from '@/helper/files'
import type { FileTypeConfig } from '@/helper/fileTypeHandler'
import useEditorViewTypeStore from '@/stores/useEditorViewTypeStore'
import useFileTypeConfigStore from '@/stores/useFileTypeConfigStore'
import Editor from './Editor'

enableMapSet()

const harness = vi.hoisted(() => ({
  events: [] as string[],
  getFileTypeConfig: vi.fn(),
  preload: vi.fn(),
  recordStage: vi.fn(),
}))

vi.mock('@/helper/fileTypeHandler', () => ({
  getFileTypeConfig: harness.getFileTypeConfig,
  isTextfileType: (config: FileTypeConfig) =>
    config.type === 'markdown' || config.type === 'json' || config.type === 'text',
}))
vi.mock('@/helper/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}))
vi.mock('@/services/editor-file', () => ({ isEmptyEditor: () => false }))
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
  default: () => {
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

afterEach(cleanup)

describe('Editor initialization lifecycle', () => {
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

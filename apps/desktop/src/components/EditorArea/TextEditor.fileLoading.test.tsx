import { runInNewContext } from 'node:vm'
import { act, cleanup, render } from '@testing-library/react'
import { createElement, useCallback, useEffect, useRef, useState, type ComponentType } from 'react'
import ts from 'typescript'
import { afterEach, describe, expect, it, vi } from 'vitest'
import useFileCacheStore, { getFileObject, setFileObject, updateFileObject } from '@/helper/files'
import { FileResultCode, type IFile } from '@/helper/filesys'
import { FileSaveCoordinator } from './fileSaveCoordinator'
import type { FileSnapshotResult } from './fileSnapshot'
import textEditorSource from './TextEditor.tsx?raw'
import { beginEditorOpenMeasurement, finishEditorOpenMeasurement, getEditorOpenMeasurement, recordEditorOpenContent, recordEditorOpenStage } from './editorPerformanceDiagnostics'

const source = ts.createSourceFile(
  'TextEditor.tsx', textEditorSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX,
)
const editor = source.statements.find((node): node is ts.FunctionDeclaration =>
  ts.isFunctionDeclaration(node) && node.name?.text === 'TextEditor',
)
if (!editor?.body) throw new Error('TextEditor implementation was not found')

// Run the production effect and dependency array through real React commits.
// Native services and the editor runtime are not needed to exercise loading.
const declarations = new Set([
  'cachedFile', 'lastKnownFileRef', 'curFile', 'filePath',
  '[status, setStatus]', '[content, setContent]', 'updateCachedFileContent',
])
let loadingEffectCount = 0
const statements = editor.body.statements.filter((node) => {
  if (ts.isVariableStatement(node)) {
    return declarations.has(node.declarationList.declarations[0].name.getText(source))
  }
  if (ts.isIfStatement(node)) return node.expression.getText(source) === 'cachedFile'
  if (
    ts.isExpressionStatement(node) && ts.isCallExpression(node.expression) &&
    node.expression.expression.getText(source) === 'useEffect' &&
    node.expression.arguments[0]?.getText(source).includes('await readStableFileSnapshot(file.path,')
  ) {
    loadingEffectCount += 1
    return true
  }
  return false
}).map((node) => node.getText(source))
if (loadingEffectCount !== 1) throw new Error('Expected exactly one file-loading effect')

interface HarnessProps {
  id: string
  language?: 'en' | 'zh'
}

function createHarness(options: { content?: string; dirty?: boolean; path?: string } = {}) {
  const file: IFile = {
    id: 'file', name: 'note.md', kind: 'file', ext: 'md',
    path: options.path ?? '/workspace/note.md', content: options.content,
  }
  useFileCacheStore.setState({ entries: {}, metadataRevision: 0, pathEntries: {} })
  setFileObject(file.id, file)
  const states = new Map([[file.id, { hasUnsavedChanges: options.dirty ?? false }]])
  const coordinator = new FileSaveCoordinator()
  coordinator.recordContent(file.id, file.content)
  coordinator.setDiskRevision(file.id, 'disk:initial')
  const snapshot = vi.fn<(path: string) => Promise<FileSnapshotResult>>()
    .mockResolvedValue({ status: 'success', content: 'disk content', revision: 'disk:loaded' })
  const toastError = vi.fn()
  const loggerError = vi.fn()
  const registry = { hasPending: vi.fn(() => false), canRead: vi.fn(() => true) }
  const bindings = {
    createElement, useCallback, useEffect, useRef, useState,
    getFileObject, updateFileObject, useFileCacheStore,
    fileSaveCoordinator: coordinator,
    useEditorStateStore: { getState: () => ({ idStateMap: states }) },
    editorSnapshotRegistry: registry,
    readStableFileSnapshot: snapshot,
    beginEditorOpenMeasurement, finishEditorOpenMeasurement, getEditorOpenMeasurement,
    recordEditorOpenContent, recordEditorOpenStage, groupId: undefined,
    fileTypeConfig: { defaultMode: 'Wysiwyg' },
    FileResultCode,
    TextEditorStatus: {
      LOADING: 'loading', SUCCESS: 'success', READERROR: 'error', NOTEXIST: 'missing', BINARY: 'binary',
    },
    i18n: { t: (key: string) => key },
    translations: { en: (key: string) => key, zh: (key: string) => `zh:${key}` },
    toast: { error: toastError },
    logger: { error: loggerError },
  }
  const compiled = ts.transpileModule(`
    function Harness({ id, language = 'en' }) {
      const t = translations[language];
      ${statements.join('\n')}
      return createElement('div', { 'data-status': status }, content);
    }
    Harness;
  `, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  const Harness = runInNewContext(compiled, bindings) as ComponentType<HarnessProps>
  return { Harness, snapshot, states, coordinator, registry, toastError, loggerError }
}

function deferred<T>() {
  let resolve: (value: T) => void = () => {}
  let reject: (error: Error) => void = () => {}
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve
    reject = onReject
  })
  return { promise, resolve, reject }
}

afterEach(cleanup)

describe('TextEditor file loading lifecycle', () => {
  it('loads once despite publishing the cache and changing language or file metadata', async () => {
    const { Harness, snapshot } = createHarness()
    const { container, findByText, rerender } = render(<Harness id='file' />)
    await findByText('disk content')
    expect(container.firstChild).toHaveProperty('dataset.status', 'success')

    updateFileObject('file', { ...getFileObject('file'), name: 'renamed.md' })
    rerender(<Harness id='file' language='zh' />)
    await act(async () => {})

    expect(snapshot).toHaveBeenCalledExactlyOnceWith('/workspace/note.md', { reuseInFlight: true })
  })

  it('uses unsaved cached content without reading disk', async () => {
    const { Harness, snapshot, coordinator } = createHarness({ content: 'unsaved', dirty: true })
    const { findByText } = render(<Harness id='file' />)
    await findByText('unsaved')
    expect(snapshot).not.toHaveBeenCalled()
    expect(coordinator.getDiskRevision('file')).toBe('disk:initial')
  })

  it('can load a file whose dirty flag has no cached or pending local content', async () => {
    const { Harness, snapshot } = createHarness({ dirty: true })
    const { findByText } = render(<Harness id='file' />)
    await findByText('disk content')
    expect(snapshot).toHaveBeenCalledOnce()
  })

  it('reads again after unmounting and reopening a clean file', async () => {
    const { Harness, snapshot } = createHarness()
    const first = render(<Harness id='file' />)
    await first.findByText('disk content')
    first.unmount()
    const second = render(<Harness id='file' />)
    await second.findByText('disk content')
    expect(snapshot).toHaveBeenCalledTimes(2)
  })

  it('reloads a changed path and ignores the previous path result', async () => {
    const { Harness, snapshot, coordinator } = createHarness()
    const oldRead = deferred<FileSnapshotResult>()
    snapshot.mockReturnValueOnce(oldRead.promise)
    const { findByText } = render(<Harness id='file' />)
    act(() => {
      updateFileObject('file', { ...getFileObject('file'), path: '/workspace/moved.md' })
    })
    await findByText('disk content')

    await act(async () => oldRead.resolve({ status: 'success', content: 'obsolete', revision: 'old' }))

    expect(snapshot).toHaveBeenCalledTimes(2)
    expect(snapshot).toHaveBeenLastCalledWith('/workspace/moved.md', { reuseInFlight: true })
    expect(getFileObject('file').content).toBe('disk content')
    expect(coordinator.getDiskRevision('file')).toBe('disk:loaded')
  })

  it('starts a new lifecycle when the file id changes', async () => {
    const { Harness, snapshot } = createHarness()
    const { rerender, findByText } = render(<Harness id='file' />)
    await findByText('disk content')
    setFileObject('other', { ...getFileObject('file'), id: 'other', path: '/workspace/other.md' })
    rerender(<Harness id='other' />)
    await act(async () => {})
    expect(snapshot).toHaveBeenCalledTimes(2)
    expect(snapshot).toHaveBeenLastCalledWith('/workspace/other.md', { reuseInFlight: true })
  })

  it.each(['resolve', 'reject'] as const)('does not publish after unmount when the read will %s', async (settle) => {
    const { Harness, snapshot, coordinator, toastError } = createHarness()
    const pending = deferred<FileSnapshotResult>()
    snapshot.mockReturnValueOnce(pending.promise)
    const { unmount } = render(<Harness id='file' />)
    unmount()

    await act(async () => {
      if (settle === 'resolve') pending.resolve({ status: 'success', content: 'late', revision: 'late' })
      else pending.reject(new Error('late error'))
    })

    expect(getFileObject('file').content).toBeUndefined()
    expect(coordinator.getDiskRevision('file')).toBe('disk:initial')
    expect(toastError).not.toHaveBeenCalled()
  })

  it.each(['dirty', 'saved', 'watcher'] as const)('preserves a newer %s publication during the read', async (change) => {
    const { Harness, snapshot, states, coordinator } = createHarness()
    const pending = deferred<FileSnapshotResult>()
    snapshot.mockReturnValueOnce(pending.promise)
    const { findByText } = render(<Harness id='file' />)
    updateFileObject('file', { ...getFileObject('file'), content: 'newer content' })
    coordinator.recordContent('file', 'newer content')
    if (change === 'dirty') states.set('file', { hasUnsavedChanges: true })
    else coordinator.setDiskRevision('file', 'disk:newer')

    await act(async () => pending.resolve({ status: 'success', content: 'stale disk', revision: 'stale' }))

    await findByText('newer content')
    expect(getFileObject('file').content).toBe('newer content')
    expect(coordinator.getDiskRevision('file')).toBe(change === 'dirty' ? 'disk:initial' : 'disk:newer')
  })

  it('protects unpublished composing content even before the dirty cache is updated', async () => {
    const { Harness, snapshot, registry, coordinator } = createHarness({ content: 'cached' })
    const pending = deferred<FileSnapshotResult>()
    snapshot.mockReturnValueOnce(pending.promise)
    const { findByText } = render(<Harness id='file' />)
    registry.canRead.mockReturnValue(false)
    registry.hasPending.mockReturnValue(true)

    await act(async () => pending.resolve({ status: 'success', content: 'stale disk', revision: 'stale' }))

    await findByText('cached')
    expect(getFileObject('file').content).toBe('cached')
    expect(coordinator.getDiskRevision('file')).toBe('disk:initial')
  })

  it('handles an IPC rejection with a read error instead of leaving loading pending', async () => {
    const { Harness, snapshot, toastError, loggerError } = createHarness()
    snapshot.mockRejectedValue(new Error('reader failed'))
    const { container } = render(<Harness id='file' />)
    await act(async () => {})
    expect(container.firstChild).toHaveProperty('dataset.status', 'error')
    expect(toastError).toHaveBeenCalledWith('external_file_change.read_failed')
    expect(loggerError).toHaveBeenCalledOnce()
  })

  it.each([
    [{ status: 'unstable' }, 'error'],
    [{ status: 'unavailable', result: { code: FileResultCode.NotFound, content: 'missing' } }, 'missing'],
    [{ status: 'unavailable', result: { code: FileResultCode.Binary, content: 'binary' } }, 'binary'],
    [{ status: 'unavailable', result: { code: FileResultCode.PermissionDenied, content: 'denied' } }, 'error'],
  ] satisfies [FileSnapshotResult, string][])('preserves the native failure state: %j', async (result, status) => {
    const { Harness, snapshot, coordinator } = createHarness()
    snapshot.mockResolvedValue(result)
    const { container } = render(<Harness id='file' />)
    await act(async () => {})
    expect(container.firstChild).toHaveProperty('dataset.status', status)
    expect(getFileObject('file').content).toBeUndefined()
    expect(coordinator.getDiskRevision('file')).toBe('disk:initial')
  })
})

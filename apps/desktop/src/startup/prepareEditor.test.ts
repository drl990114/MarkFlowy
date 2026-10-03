import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { invalidateFileSnapshotHandoffs, readStableFileSnapshot } from '@/components/EditorArea/fileSnapshot'
import { prepareStartupDocumentRead, prepareStartupEditorModules, takeStartupDocumentRead } from './prepareEditor'
import { EditorViewType } from '@/constants/editorViewType'

const controls = vi.hoisted(() => ({
  file: { id: 'file', name: 'file.md', path: '/w/file.md', kind: 'file', content: undefined as string | undefined },
  state: { activeId: 'file', folderData: [{ path: '/w' }] },
  revision: 0,
  dirty: false,
  pending: false,
  snapshotPending: false,
  invoke: vi.fn(),
  area: vi.fn(async () => ({})),
  runtime: vi.fn(async () => undefined),
  mode: undefined as string | undefined,
}))
vi.mock('@tauri-apps/api/core', () => ({ invoke: controls.invoke }))
vi.mock('@/helper/files', () => ({ getFileObject: () => controls.file }))
vi.mock('@/services/draftRecoveryState', () => ({ isDraftRecoveryPending: () => controls.pending }))
vi.mock('@/components/EditorArea/editorAreaLoader', () => ({ loadEditorAreaContent: controls.area }))
vi.mock('@/components/EditorArea/capricornRuntimeAdapter', () => ({ preloadCapricornRuntimeFactory: controls.runtime }))
vi.mock('@/components/EditorArea/fileSaveCoordinator', () => ({
  fileSaveCoordinator: { getRevision: () => controls.revision, getDiskRevision: () => 'base' },
}))
vi.mock('@/components/EditorArea/editorSnapshotRegistry', () => ({
  editorSnapshotRegistry: { hasPending: () => controls.snapshotPending, canRead: () => true },
}))
vi.mock('@/stores/useEditorStore', () => ({ default: { getState: () => controls.state } }))
vi.mock('@/stores/useEditorStateStore', () => ({
  default: { getState: () => ({ idStateMap: new Map([['file', { hasUnsavedChanges: controls.dirty }]]) }) },
}))
vi.mock('@/stores/useEditorViewTypeStore', () => ({
  default: { getState: () => ({ editorViewTypeMap: new Map([['file', controls.mode]]) }) },
}))

let controller: AbortController
const snapshot = { status: 'success', content: '# Markdown', revision: 'disk:1' }
beforeEach(() => {
  vi.clearAllMocks()
  controller = new AbortController()
  controls.state = { activeId: 'file', folderData: [{ path: '/w' }] }
  controls.file.content = undefined
  controls.mode = EditorViewType.WYSIWYG
  controls.revision = 0
  controls.dirty = false
  controls.pending = false
  controls.snapshotPending = false
  controls.invoke.mockResolvedValue(snapshot)
})
afterEach(() => controller.abort())

it('hands a completed startup read to only the intended editor once without another native read', async () => {
  await prepareStartupDocumentRead(controller.signal)
  await Promise.resolve()
  expect(takeStartupDocumentRead('other', '/w/file.md')).toBeUndefined()
  await expect(takeStartupDocumentRead('file', '/w/file.md')).resolves.toBe(snapshot)
  expect(takeStartupDocumentRead('file', '/w/file.md')).toBeUndefined()
  expect(controls.invoke).toHaveBeenCalledOnce()
})

it.each(['edit', 'switch', 'root', 'draft', 'pending model', 'cancel', 'file event', 'fresh read'])(
  'drops startup bytes after %s instead of serving a stale snapshot', async (change) => {
    await prepareStartupDocumentRead(controller.signal)
    if (change === 'edit') controls.revision++
    if (change === 'switch') controls.state.activeId = 'other'
    if (change === 'root') controls.state.folderData = [{ path: '/w' }]
    if (change === 'draft') controls.dirty = true
    if (change === 'pending model') controls.snapshotPending = true
    if (change === 'cancel') controller.abort()
    if (change === 'file event') invalidateFileSnapshotHandoffs('/w/file.md')
    if (change === 'fresh read') await readStableFileSnapshot('/w/file.md')
    expect(await takeStartupDocumentRead('file', '/w/file.md')).toBeUndefined()
  },
)

it('never pre-reads a document whose recovered content is pending or dirty', async () => {
  controls.pending = true
  await prepareStartupDocumentRead(controller.signal)
  controls.pending = false
  controls.dirty = true
  await prepareStartupDocumentRead(controller.signal)
  expect(controls.invoke).not.toHaveBeenCalled()
})

it('prepares the selected engine before recovery and respects source/preview mode choices', async () => {
  controls.pending = true
  await prepareStartupEditorModules(controller.signal)
  expect(controls.area).toHaveBeenCalledOnce()
  expect(controls.runtime).toHaveBeenCalledOnce()
  expect(controls.invoke).not.toHaveBeenCalled()
  controls.mode = EditorViewType.SOURCECODE
  await prepareStartupEditorModules(controller.signal)
  expect(controls.runtime).toHaveBeenCalledOnce()
  controls.mode = EditorViewType.PREVIEW
  await prepareStartupEditorModules(controller.signal)
  expect(controls.runtime).toHaveBeenCalledTimes(2)
})

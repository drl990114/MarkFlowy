import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { enableMapSet } from 'immer'
import useFileCacheStore, { getFileObject } from '@/helper/files'
import useEditorStore from '@/stores/useEditorStore'
import useEditorStateStore from '@/stores/useEditorStateStore'
import { savePathCoordinator } from '@/components/EditorArea/savePathCoordinator'
import { addExistingMarkdownFileEdit, addNewMarkdownFileEdit } from './editor-file'
import { listenForUpdateSession } from './update-session'

const mocks = vi.hoisted(() => ({ listen: vi.fn(), emitTo: vi.fn(), stop: vi.fn() }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('@tauri-apps/api/event', () => ({ listen: mocks.listen, emitTo: mocks.emitTo }))
vi.mock('zens', () => ({ toast: { error: vi.fn() } }))

let dispose: (() => void) | undefined
beforeEach(() => {
  enableMapSet()
  vi.clearAllMocks()
  mocks.listen.mockResolvedValue(mocks.stop)
  mocks.emitTo.mockResolvedValue(undefined)
  useFileCacheStore.setState({ entries: {}, contentEntries: {}, pathEntries: {}, metadataRevision: 0 })
  useEditorStateStore.setState({ idStateMap: new Map() })
  useEditorStore.getState().setEditorLayout({ type: 'leaf', id: 'group', opened: [] }, 'group')
})
afterEach(() => { dispose?.(); dispose = undefined })

it('defers an Ask-style new draft after the update ACK until the barrier is released', async () => {
  dispose = await listenForUpdateSession('main', { prepare: async () => {}, flush: async () => {} })
  const request = { id: 'update', replyTo: 'main', expiresAt: Date.now() + 30_000 }
  const receiveRequest = mocks.listen.mock.calls.find(([event]) => event === 'mf-update-session-request')![1]
  const receiveRelease = mocks.listen.mock.calls.find(([event]) => event === 'mf-update-session-release')![1]
  const preserving = receiveRequest({ payload: request })
  await vi.waitFor(() => expect(mocks.emitTo).toHaveBeenCalledWith('main', 'mf-update-session-response', {
    id: 'update', label: 'main',
  }))

  const creating = addNewMarkdownFileEdit({ fileName: 'ai-ask.md', content: 'Keep the exported response' })
  await Promise.resolve()
  expect(useEditorStore.getState().opened).toEqual([])
  expect(Object.keys(useFileCacheStore.getState().entries)).toEqual([])

  receiveRelease({ payload: request })
  await preserving
  await creating
  const [id] = useEditorStore.getState().opened
  expect(getFileObject(id)).toMatchObject({ name: 'ai-ask.md', content: 'Keep the exported response' })
  expect(useEditorStateStore.getState().idStateMap.get(id)?.hasUnsavedChanges).toBe(true)
})

it('still permits existing-file opens inside a workspace file-mutation lease', async () => {
  await savePathCoordinator.runFileMutation(() => addExistingMarkdownFileEdit({
    fileName: 'existing.md', path: '/workspace/existing.md', content: 'Existing contents',
  }))
  const [id] = useEditorStore.getState().opened
  expect(getFileObject(id).path).toBe('/workspace/existing.md')
})

import useAppSettingStore from '@/stores/useAppSettingStore'
import useEditorStore from '@/stores/useEditorStore'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { openStandaloneFile } from './open-file'

const mocks = vi.hoisted(() => ({
  addExistingFile: vi.fn(),
  invoke: vi.fn(),
}))

vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }))
vi.mock('@/helper/filesys', () => ({
  getFileNameFromPath: (path: string) => path.split('/').at(-1),
}))
vi.mock('./editor-file', () => ({
  addExistingMarkdownFileEdit: mocks.addExistingFile,
  isEmptyEditor: vi.fn(),
}))

beforeEach(() => {
  useAppSettingStore.setState({ settingData: {} })
  useEditorStore.setState({ folderData: null, opened: ['source-draft'], activeId: 'source-draft' })
  mocks.invoke.mockReset().mockImplementation(async (command: string) => {
    if (command === 'is_file_in_workspace') return false
    if (command === 'create_new_window') return 'document-window'
    throw new Error(`Unexpected command: ${command}`)
  })
  mocks.addExistingFile.mockReset().mockResolvedValue(undefined)
})

const setWorkspace = () => useEditorStore.setState({
  folderData: [{ id: 'workspace', kind: 'dir', name: 'Workspace', path: '/workspace' }],
})

describe('standalone file opening', () => {
  it.each([{}, { open_file_in_new_window: true }])(
    'creates a new window when the setting is enabled or missing: %j',
    async (settingData) => {
      useAppSettingStore.setState({ settingData })

      await expect(openStandaloneFile('/documents/notes.md')).resolves.toBe('new')

      expect(mocks.invoke).toHaveBeenCalledWith('create_new_window', {
        path: '/documents/notes.md',
      })
      expect(mocks.addExistingFile).not.toHaveBeenCalled()
      expect(mocks.invoke).not.toHaveBeenCalledWith('is_file_in_workspace', expect.anything())
    },
  )

  it('reads the latest preference for every call', async () => {
    useAppSettingStore.setState({ settingData: { open_file_in_new_window: false } })
    await expect(openStandaloneFile('/documents/first.md')).resolves.toBe('current')

    useAppSettingStore.setState({ settingData: { open_file_in_new_window: true } })
    await expect(openStandaloneFile('/documents/second.md')).resolves.toBe('new')

    useAppSettingStore.setState({ settingData: { open_file_in_new_window: false } })
    await expect(openStandaloneFile('/documents/third.txt')).resolves.toBe('current')

    expect(mocks.addExistingFile.mock.calls).toEqual([
      [{ fileName: 'first.md', ext: 'md', path: '/documents/first.md' }],
      [{ fileName: 'third.txt', ext: 'txt', path: '/documents/third.txt' }],
    ])
    expect(mocks.invoke).toHaveBeenCalledOnce()
    expect(mocks.invoke).toHaveBeenCalledWith('create_new_window', {
      path: '/documents/second.md',
    })
  })

  it('opens a child window bootstrap in that window without creating another child', async () => {
    setWorkspace()
    await expect(openStandaloneFile('/documents/bootstrap.md', 'current')).resolves.toBe('current')

    expect(mocks.addExistingFile).toHaveBeenCalledWith({
      fileName: 'bootstrap.md',
      ext: 'md',
      path: '/documents/bootstrap.md',
    })
    expect(mocks.invoke).not.toHaveBeenCalled()
  })

  it('keeps files belonging to the current workspace in that window', async () => {
    setWorkspace()
    mocks.invoke.mockResolvedValueOnce(true)

    await expect(openStandaloneFile('/workspace/notes.md')).resolves.toBe('current')

    expect(mocks.invoke.mock.calls).toEqual([
      ['is_file_in_workspace', { path: '/workspace/notes.md', rootPath: '/workspace' }],
    ])
    expect(mocks.addExistingFile).toHaveBeenCalledWith({
      fileName: 'notes.md', ext: 'md', path: '/workspace/notes.md',
    })
  })

  it('opens files outside the current workspace in a new window', async () => {
    setWorkspace()

    await expect(openStandaloneFile('/workspace-neighbor/notes.md')).resolves.toBe('new')

    expect(mocks.invoke.mock.calls).toEqual([
      ['is_file_in_workspace', { path: '/workspace-neighbor/notes.md', rootPath: '/workspace' }],
      ['create_new_window', { path: '/workspace-neighbor/notes.md' }],
    ])
    expect(mocks.addExistingFile).not.toHaveBeenCalled()
  })

  it('opens in the current window without querying membership when the setting is disabled', async () => {
    setWorkspace()
    useAppSettingStore.setState({ settingData: { open_file_in_new_window: false } })

    await expect(openStandaloneFile('/documents/notes.md')).resolves.toBe('current')

    expect(mocks.invoke).not.toHaveBeenCalled()
    expect(mocks.addExistingFile).toHaveBeenCalledWith({
      fileName: 'notes.md', ext: 'md', path: '/documents/notes.md',
    })
  })

  it('requires an explicit true membership result before retaining a workspace file locally', async () => {
    setWorkspace()
    mocks.invoke.mockResolvedValueOnce('true')

    await expect(openStandaloneFile('/workspace/notes.md')).resolves.toBe('new')

    expect(mocks.invoke).toHaveBeenCalledWith('create_new_window', { path: '/workspace/notes.md' })
    expect(mocks.addExistingFile).not.toHaveBeenCalled()
  })

  it('propagates a window creation failure without opening the file in the source', async () => {
    mocks.invoke.mockRejectedValueOnce(new Error('window unavailable'))

    await expect(openStandaloneFile('/documents/notes.md')).rejects.toThrow('window unavailable')

    expect(mocks.addExistingFile).not.toHaveBeenCalled()
  })
})

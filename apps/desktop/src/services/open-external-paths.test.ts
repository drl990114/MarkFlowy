import useAppSettingStore from '@/stores/useAppSettingStore'
import useEditorStore from '@/stores/useEditorStore'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { openExternalPaths } from './open-external-paths'

const mocks = vi.hoisted(() => ({
  addExistingFile: vi.fn(),
  createWorkspaceWindow: vi.fn(),
  invoke: vi.fn(),
  openWorkspace: vi.fn(),
  removePristineDocuments: vi.fn(),
  setFocus: vi.fn(),
}))

vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }))
vi.mock('@/helper/filesys', () => ({
  getFileNameFromPath: (path: string) => path.split('/').at(-1),
}))
vi.mock('@/helper/logger', () => ({ logger: { debug: vi.fn() } }))
vi.mock('./editor-file', () => ({
  addExistingMarkdownFileEdit: mocks.addExistingFile,
  removePristineDocuments: mocks.removePristineDocuments,
  isEmptyEditor: vi.fn(),
}))
vi.mock('./windows', () => ({
  createNewWindow: mocks.createWorkspaceWindow,
  currentWindow: { setFocus: mocks.setFocus },
}))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.invoke.mockReset().mockImplementation(async (command: string) => {
    if (command === 'is_dir') return false
    if (command === 'is_file_in_workspace') return false
    if (command === 'create_new_window') return 'document-window'
    throw new Error(`Unexpected command: ${command}`)
  })
  mocks.addExistingFile.mockReset().mockResolvedValue(undefined)
  mocks.createWorkspaceWindow.mockReset().mockResolvedValue(undefined)
  mocks.openWorkspace.mockReset().mockResolvedValue(undefined)
  mocks.setFocus.mockReset().mockResolvedValue(undefined)
  useAppSettingStore.setState({ settingData: {} })
  useEditorStore.setState({ folderData: null, opened: ['source-draft'], activeId: 'source-draft' })
})

const directoryPaths = (paths: string[]) => {
  mocks.invoke.mockImplementation(async (command: string, { path }: { path: string }) => {
    if (command === 'is_dir') return paths.includes(path)
    if (command === 'is_file_in_workspace') return false
    if (command === 'create_new_window') return 'document-window'
    throw new Error(`Unexpected command: ${command}`)
  })
}

const workspaceFilePaths = (paths: string[]) => {
  useEditorStore.setState({
    folderData: [{ id: 'workspace', kind: 'dir', name: 'Workspace', path: '/workspace' }],
  })
  mocks.invoke.mockImplementation(async (command: string, { path }: { path: string }) => {
    if (command === 'is_dir') return false
    if (command === 'is_file_in_workspace') return paths.includes(path)
    if (command === 'create_new_window') return 'document-window'
    throw new Error(`Unexpected command: ${command}`)
  })
}

describe('external path opening', () => {
  it('opens runtime files in new windows without pulling focus back or switching the workspace', async () => {
    const source = useEditorStore.getState()

    await openExternalPaths(['/documents/one.md', '/documents/two.md'], 'preference', mocks.openWorkspace)

    expect(mocks.invoke).toHaveBeenCalledWith('create_new_window', { path: '/documents/one.md' })
    expect(mocks.invoke).toHaveBeenCalledWith('create_new_window', { path: '/documents/two.md' })
    expect(mocks.addExistingFile).not.toHaveBeenCalled()
    expect(mocks.createWorkspaceWindow).not.toHaveBeenCalled()
    expect(mocks.openWorkspace).not.toHaveBeenCalled()
    expect(mocks.removePristineDocuments).not.toHaveBeenCalled()
    expect(mocks.setFocus).not.toHaveBeenCalled()
    expect(useEditorStore.getState()).toBe(source)
    expect(mocks.invoke).not.toHaveBeenCalledWith('is_file_in_workspace', expect.anything())
  })

  it('opens a runtime workspace file locally and restores focus to its window', async () => {
    workspaceFilePaths(['/workspace/notes.md'])

    await openExternalPaths(['/workspace/notes.md'], 'preference', mocks.openWorkspace)

    expect(mocks.invoke).toHaveBeenCalledWith('is_file_in_workspace', {
      path: '/workspace/notes.md', rootPath: '/workspace',
    })
    expect(mocks.addExistingFile).toHaveBeenCalledWith({
      fileName: 'notes.md', ext: 'md', path: '/workspace/notes.md',
    })
    expect(mocks.invoke).not.toHaveBeenCalledWith('create_new_window', expect.anything())
    expect(mocks.setFocus).toHaveBeenCalledOnce()
    expect(mocks.openWorkspace).not.toHaveBeenCalled()
    expect(mocks.createWorkspaceWindow).not.toHaveBeenCalled()
  })

  it('opens mixed runtime files in their targets without pulling focus from the new window', async () => {
    workspaceFilePaths(['/workspace/notes.md'])

    await openExternalPaths(
      ['/workspace/notes.md', '/documents/external.md'],
      'preference',
      mocks.openWorkspace,
    )

    expect(mocks.addExistingFile.mock.calls).toEqual([
      [{ fileName: 'notes.md', ext: 'md', path: '/workspace/notes.md' }],
    ])
    expect(mocks.invoke).not.toHaveBeenCalledWith('create_new_window', { path: '/workspace/notes.md' })
    expect(mocks.invoke).toHaveBeenCalledWith('create_new_window', { path: '/documents/external.md' })
    expect(mocks.setFocus).not.toHaveBeenCalled()
    expect(mocks.openWorkspace).not.toHaveBeenCalled()
    expect(mocks.createWorkspaceWindow).not.toHaveBeenCalled()
  })

  it('owns the first bootstrap file and routes additional files through the preference', async () => {
    await openExternalPaths(['/documents/one.md', '/documents/two.md'], 'current', mocks.openWorkspace)

    expect(mocks.addExistingFile.mock.calls).toEqual([
      [{ fileName: 'one.md', ext: 'md', path: '/documents/one.md' }],
    ])
    expect(mocks.invoke).not.toHaveBeenCalledWith('create_new_window', { path: '/documents/one.md' })
    expect(mocks.invoke).toHaveBeenCalledWith('create_new_window', { path: '/documents/two.md' })
    expect(mocks.openWorkspace).not.toHaveBeenCalled()
    expect(mocks.createWorkspaceWindow).not.toHaveBeenCalled()
    expect(mocks.setFocus).not.toHaveBeenCalled()
  })

  it('keeps all bootstrap files in the current window when the setting is disabled', async () => {
    useAppSettingStore.setState({ settingData: { open_file_in_new_window: false } })

    await openExternalPaths(['/documents/one.md', '/documents/two.md'], 'current', mocks.openWorkspace)

    expect(mocks.addExistingFile).toHaveBeenCalledTimes(2)
    expect(mocks.invoke.mock.calls.every(([command]) => command === 'is_dir')).toBe(true)
    expect(mocks.setFocus).toHaveBeenCalledOnce()
  })

  it('focuses the current window for runtime files after the preference is disabled', async () => {
    workspaceFilePaths([])
    useAppSettingStore.setState({ settingData: { open_file_in_new_window: false } })

    await openExternalPaths(['/documents/notes.md'], 'preference', mocks.openWorkspace)

    expect(mocks.addExistingFile).toHaveBeenCalledWith({
      fileName: 'notes.md', ext: 'md', path: '/documents/notes.md',
    })
    expect(mocks.setFocus).toHaveBeenCalledOnce()
    expect(mocks.openWorkspace).not.toHaveBeenCalled()
    expect(mocks.invoke).not.toHaveBeenCalledWith('is_file_in_workspace', expect.anything())
  })

  it('keeps the source session after a failed new document window', async () => {
    const source = useEditorStore.getState()
    mocks.invoke.mockImplementation(async (command: string) => {
      if (command === 'is_dir') return false
      throw new Error('window unavailable')
    })

    await expect(
      openExternalPaths(['/documents/notes.md'], 'preference', mocks.openWorkspace),
    ).rejects.toThrow('window unavailable')

    expect(useEditorStore.getState()).toBe(source)
    expect(mocks.addExistingFile).not.toHaveBeenCalled()
    expect(mocks.createWorkspaceWindow).not.toHaveBeenCalled()
    expect(mocks.openWorkspace).not.toHaveBeenCalled()
    expect(mocks.removePristineDocuments).not.toHaveBeenCalled()
    expect(mocks.setFocus).not.toHaveBeenCalled()
  })

  it('opens a single folder in an empty window through the existing workspace flow', async () => {
    directoryPaths(['/workspace'])

    await openExternalPaths(['/workspace'], 'preference', mocks.openWorkspace)

    expect(mocks.removePristineDocuments).toHaveBeenCalledOnce()
    expect(mocks.openWorkspace).toHaveBeenCalledWith('/workspace')
    expect(mocks.createWorkspaceWindow).not.toHaveBeenCalled()
    expect(mocks.addExistingFile).not.toHaveBeenCalled()
  })

  it('retains the current workspace when another folder is opened', async () => {
    directoryPaths(['/other'])
    useEditorStore.setState({
      folderData: [{ id: 'workspace', kind: 'dir', name: 'Workspace', path: '/workspace' }],
    })

    await openExternalPaths(['/other'], 'preference', mocks.openWorkspace)

    expect(mocks.createWorkspaceWindow).toHaveBeenCalledWith({ path: '/other' })
    expect(mocks.openWorkspace).not.toHaveBeenCalled()
    expect(mocks.removePristineDocuments).not.toHaveBeenCalled()
    expect(mocks.setFocus).not.toHaveBeenCalled()
  })

  it('reopens the same folder in the current workspace', async () => {
    directoryPaths(['/workspace'])
    useEditorStore.setState({
      folderData: [{ id: 'workspace', kind: 'dir', name: 'Workspace', path: '/workspace' }],
    })

    await openExternalPaths(['/workspace'], 'preference', mocks.openWorkspace)

    expect(mocks.openWorkspace).toHaveBeenCalledWith('/workspace')
    expect(mocks.createWorkspaceWindow).not.toHaveBeenCalled()
  })

  it.each([
    ['/workspace', '/documents/one.md', '/documents/two.md'],
    ['/documents/one.md', '/workspace', '/documents/two.md'],
    ['/documents/one.md', '/documents/two.md', '/workspace'],
  ])('owns the first file in a mixed bootstrap batch: %j', async (...paths) => {
    directoryPaths(['/workspace'])

    await openExternalPaths(paths, 'current', mocks.openWorkspace)

    expect(mocks.addExistingFile).toHaveBeenCalledWith({
      fileName: 'one.md', ext: 'md', path: '/documents/one.md',
    })
    expect(mocks.createWorkspaceWindow.mock.calls).toEqual([[{ path: '/workspace' }]])
    expect(mocks.invoke).toHaveBeenCalledWith('create_new_window', { path: '/documents/two.md' })
    expect(mocks.openWorkspace).not.toHaveBeenCalled()
    expect(mocks.setFocus).not.toHaveBeenCalled()
  })
})

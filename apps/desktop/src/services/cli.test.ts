import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cliReceipt, contentSha256, type CliRequest } from './cliProtocol'
import { listenForCliRequests, runCliRequest } from './cli'

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  render: vi.fn(),
  add: vi.fn(),
  activate: vi.fn(),
  refresh: vi.fn(),
  content: '# target',
  opened: ['target', 'other'],
  activeId: 'other',
  hasCommand: vi.fn(),
  execute: vi.fn(),
  listen: vi.fn(),
}))
const files: Record<string, { id: string; name: string; path: string }> = {
  target: { id: 'target', name: 'target.md', path: '/target.md' },
  other: { id: 'other', name: 'other.md', path: '/other.md' },
}

vi.mock('@/commands', () => ({
  commandRegistry: { hasCommand: mocks.hasCommand, execute: mocks.execute },
}))
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }))
vi.mock('@/helper/logger', () => ({ logger: { error: vi.fn() } }))
vi.mock('@/helper/filesys', () => ({
  getFileNameFromPath: (path: string) => path.split('/').pop(),
}))
vi.mock('@/helper/files', () => ({
  getFileObject: (id: string) => files[id],
  getFileIdsByPathIdentity: (path: string) =>
    Object.values(files)
      .filter((file) => file.path === path)
      .map((file) => file.id),
}))
vi.mock('@/stores', () => ({
  useEditorStore: {
    getState: () => ({
      opened: mocks.opened,
      activeId: mocks.activeId,
      setActiveId: mocks.activate,
    }),
  },
  useEditorStateStore: { getState: () => ({ idStateMap: new Map() }) },
}))
vi.mock('@/stores/useExternalFileChangeStore', () => ({
  default: { getState: () => ({ notices: {} }) },
}))
vi.mock('@/components/EditorArea/externalFileChanges', () => ({
  handleExternalWatchEvent: mocks.refresh,
}))
vi.mock('./editor-file', () => ({ addExistingMarkdownFileEdit: mocks.add }))
vi.mock('./windows', () => ({ currentWindow: { label: 'main', listen: mocks.listen } }))
vi.mock('./workspace-switch', () => ({ switchWorkspaceInCurrentWindow: vi.fn() }))
vi.mock('@/components/EditorArea/editorAutomationRegistry', () => {
  const handle = {
    inspect: () => ({
      ready: true,
      visible: true,
      active: mocks.activeId === 'target',
      mode: 'preview',
    }),
    readContent: () => mocks.content,
    preview: vi.fn(),
    render: mocks.render,
  }
  return {
    editorAutomationRegistry: { get: (id: string) => (id === 'target' ? handle : undefined) },
  }
})

const request = async (patch: Partial<CliRequest> = {}): Promise<CliRequest> => ({
  protocolVersion: 1,
  requestId: 'cli-export',
  operation: 'export',
  path: '/target.md',
  windowId: 'main',
  commandId: null,
  preview: false,
  waitFor: 'applied',
  expectedSha256: await contentSha256('# target'),
  output: '/out/target.html',
  format: 'html',
  overwrite: false,
  deadline: Date.now() + 2000,
  ...patch,
})

beforeEach(() => {
  vi.clearAllMocks()
  mocks.content = '# target'
  mocks.activeId = 'other'
  mocks.opened = ['target', 'other']
  mocks.activate.mockImplementation((id) => {
    mocks.activeId = id
  })
  mocks.hasCommand.mockReturnValue(true)
  mocks.render.mockResolvedValue(new TextEncoder().encode('<p>target</p>'))
  mocks.invoke.mockImplementation(async (command, args) => {
    if (command === 'paths_refer_to_same_file') return args.path1 === args.path2
    if (command === 'cli_write_export')
      return { path: '/out/target.html', bytes: 13, sha256: 'output-hash' }
    throw new Error(`Unexpected command: ${command}`)
  })
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    queueMicrotask(() => callback(0))
    return 1
  })
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('targeted CLI operations', () => {
  it('announces readiness only after the event listener exists and scopes cleanup to that listener', async () => {
    let register!: (stop: () => void) => void
    const unlisten = vi.fn()
    mocks.listen.mockReturnValue(
      new Promise((resolve) => {
        register = resolve
      }),
    )
    mocks.invoke.mockResolvedValue(undefined)
    const pending = listenForCliRequests()
    expect(mocks.invoke).not.toHaveBeenCalled()
    register(unlisten)
    const stop = await pending
    const listenerId = mocks.invoke.mock.calls[0][1].listenerId
    expect(mocks.invoke).toHaveBeenCalledWith('cli_ready', { ready: true, listenerId })
    stop()
    expect(unlisten).toHaveBeenCalledOnce()
    expect(mocks.invoke).toHaveBeenCalledWith('cli_ready', { ready: false, listenerId })
  })
  it('exports the requested file and waits for the native verified write', async () => {
    let completeWrite!: (value: unknown) => void
    const written = new Promise((resolve) => {
      completeWrite = resolve
    })
    mocks.invoke.mockImplementation(async (command, args) => {
      if (command === 'paths_refer_to_same_file') return args.path1 === args.path2
      if (command === 'cli_write_export') return written
    })
    let settled = false
    const pending = runCliRequest(await request()).then((result) => {
      settled = true
      return result
    })
    await vi.waitFor(() =>
      expect(mocks.invoke).toHaveBeenCalledWith('cli_write_export', {
        requestId: 'cli-export',
        content: Array.from(new TextEncoder().encode('<p>target</p>')),
      }),
    )
    expect(mocks.activate).toHaveBeenCalledWith('target')
    expect(settled).toBe(false)
    completeWrite({ path: '/out/target.html', bytes: 13, sha256: 'verified' })
    expect(await pending).toMatchObject({
      code: 'export_completed',
      result: { output: { sha256: 'verified' }, file: { fileId: 'target', applied: true } },
    })
  })

  it('does not write when the target changes during rendering', async () => {
    mocks.render.mockImplementation(async () => {
      mocks.content = '# edited during export'
      return new Uint8Array([1])
    })
    const req = await request()
    expect(await cliReceipt(req, () => runCliRequest(req))).toMatchObject({
      ok: false,
      code: 'content_changed',
    })
    expect(mocks.invoke.mock.calls.some(([command]) => command === 'cli_write_export')).toBe(false)
  })

  it('propagates native output failures into an error receipt', async () => {
    mocks.invoke.mockImplementation(async (command) => {
      if (command === 'cli_write_export') throw new Error('Permission denied')
      return true
    })
    const req = await request()
    expect(await cliReceipt(req, () => runCliRequest(req))).toMatchObject({
      ok: false,
      code: 'export_failed',
      message: 'Error: Permission denied',
    })
  })

  it('queries unopened files without opening them or switching tabs', async () => {
    mocks.opened = ['other']
    expect(await runCliRequest(await request({ operation: 'status' }))).toMatchObject({
      code: 'file_status',
      result: { open: false, applied: false, visible: false },
    })
    expect(mocks.activate).not.toHaveBeenCalled()
    expect(mocks.add).not.toHaveBeenCalled()
  })

  it('rejects another window without falling back to the active target', async () => {
    await expect(runCliRequest(await request({ windowId: 'missing' }))).rejects.toMatchObject({
      code: 'wrong_window',
    })
    expect(mocks.activate).not.toHaveBeenCalled()
    expect(mocks.render).not.toHaveBeenCalled()
  })

  it('distinguishes GUI dispatch from operation completion and reports unknown commands', async () => {
    const req = await request({ operation: 'command', commandId: 'app_save' })
    expect(await runCliRequest(req)).toMatchObject({
      code: 'dispatched',
      result: { completed: false },
    })
    mocks.hasCommand.mockReturnValue(false)
    await expect(runCliRequest(req)).rejects.toMatchObject({ code: 'command_not_found' })
  })
})

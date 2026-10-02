import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cliReceipt, contentSha256, type CliRequest } from './cliProtocol'
import { listenForCliRequests, runCliRequest } from './cli'
import { fileSaveCoordinator } from '@/components/EditorArea/fileSaveCoordinator'
import { DEFAULT_TEXT_METADATA } from '@/components/EditorArea/textFileFormat'

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
  ready: true,
  snapshotBytes: new Uint8Array(),
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
      ready: mocks.ready,
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

beforeEach(async () => {
  vi.clearAllMocks()
  await fileSaveCoordinator.releaseWhenIdle(
    'target',
    () => true,
    () => undefined,
  )
  mocks.content = '# target'
  mocks.ready = true
  mocks.snapshotBytes = new TextEncoder().encode('# target')
  mocks.activeId = 'other'
  mocks.opened = ['target', 'other']
  mocks.activate.mockImplementation((id) => {
    mocks.activeId = id
  })
  mocks.hasCommand.mockReturnValue(true)
  mocks.render.mockResolvedValue(new TextEncoder().encode('<p>target</p>'))
  mocks.invoke.mockImplementation(async (command, args) => {
    if (command === 'paths_refer_to_same_file') return args.path1 === args.path2
    if (command === 'cli_hash_snapshot') {
      return contentSha256(new TextDecoder(args.encoding ?? 'utf-8').decode(mocks.snapshotBytes))
    }
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
  function loadGbk() {
    mocks.snapshotBytes = new Uint8Array([0xc2, 0xa9, 0x21])
    mocks.content = '漏!'
    fileSaveCoordinator.loadSnapshot('target', {
      status: 'success',
      content: mocks.content,
      revision: 'disk:gbk',
      text: {
        ...DEFAULT_TEXT_METADATA,
        format: { encoding: 'gbk', bom: 'none' },
        decoding: { source: 'user', needsConfirmation: false, byteRoundTrip: true },
      },
    })
  }

  it.each(['status', 'wait', 'open', 'export'] as const)(
    'uses the selected GBK decoder for the default %s digest',
    async (operation) => {
      loadGbk()
      expect(new TextDecoder().decode(mocks.snapshotBytes)).toBe('©!')
      const req = await request({ operation, expectedSha256: null })
      const receipt = await cliReceipt(req, () => runCliRequest(req))
      expect(receipt.ok).toBe(true)
      const state =
        operation === 'export' ? (receipt.result as { file: unknown }).file : receipt.result
      expect(state).toMatchObject({
        applied: true,
        contentSha256: await contentSha256('漏!'),
        expectedSha256: await contentSha256('漏!'),
      })
      expect(mocks.invoke).toHaveBeenCalledWith('cli_hash_snapshot', {
        requestId: req.requestId,
        encoding: 'gbk',
      })
      expect(
        mocks.invoke.mock.calls.filter(([command]) => command === 'cli_hash_snapshot'),
      ).toHaveLength(1)
      expect(mocks.refresh).not.toHaveBeenCalled()
    },
  )

  it('uses the saved GBK decoder during an unsaved UTF-8 conversion', async () => {
    loadGbk()
    fileSaveCoordinator.recordFormat('target', { encoding: 'utf-8', bom: 'none' })
    expect(
      await runCliRequest(await request({ operation: 'status', expectedSha256: null })),
    ).toMatchObject({ result: { applied: true, expectedSha256: await contentSha256('漏!') } })
  })

  it('keeps an explicit digest authoritative for a GBK document', async () => {
    loadGbk()
    const explicit = await contentSha256('©!')
    expect(
      await runCliRequest(await request({ operation: 'status', expectedSha256: explicit })),
    ).toMatchObject({ result: { applied: false, expectedSha256: explicit } })
    expect(mocks.invoke.mock.calls.some(([command]) => command === 'cli_hash_snapshot')).toBe(false)
  })

  it('waits for the document decoder to load before resolving its default digest', async () => {
    mocks.ready = false
    const pending = runCliRequest(await request({ operation: 'wait', expectedSha256: null }))
    await vi.waitFor(() =>
      expect(mocks.invoke).toHaveBeenCalledWith('paths_refer_to_same_file', {
        path1: '/target.md',
        path2: '/target.md',
      }),
    )
    expect(mocks.invoke.mock.calls.some(([command]) => command === 'cli_hash_snapshot')).toBe(false)
    loadGbk()
    mocks.ready = true
    expect(await pending).toMatchObject({ code: 'content_applied', result: { applied: true } })
    expect(mocks.invoke).toHaveBeenCalledWith('cli_hash_snapshot', {
      requestId: 'cli-export',
      encoding: 'gbk',
    })
  })

  it('rechecks the decoder when it changes while resolving the snapshot digest', async () => {
    loadGbk()
    let completeHash!: (hash: string) => void
    const hashing = new Promise<string>((resolve) => {
      completeHash = resolve
    })
    const invoke = mocks.invoke.getMockImplementation()!
    mocks.invoke.mockImplementation((command, args) => {
      if (command === 'cli_hash_snapshot' && args.encoding === 'gbk') return hashing
      return invoke(command, args)
    })
    const pending = runCliRequest(await request({ operation: 'wait', expectedSha256: null }))
    await vi.waitFor(() =>
      expect(mocks.invoke).toHaveBeenCalledWith('cli_hash_snapshot', {
        requestId: 'cli-export',
        encoding: 'gbk',
      }),
    )
    mocks.content = '©!'
    fileSaveCoordinator.loadSnapshot('target', {
      content: mocks.content,
      revision: 'disk:utf8',
      status: 'success',
      text: DEFAULT_TEXT_METADATA,
    })
    completeHash(await contentSha256('漏!'))
    expect(await pending).toMatchObject({
      code: 'content_applied',
      result: { applied: true, expectedSha256: await contentSha256('©!') },
    })
    expect(mocks.invoke).toHaveBeenCalledWith('cli_hash_snapshot', {
      requestId: 'cli-export',
      encoding: undefined,
    })
    expect(mocks.refresh).not.toHaveBeenCalled()
  })

  it('does not export when the decoder changes during rendering', async () => {
    loadGbk()
    mocks.render.mockImplementation(async () => {
      fileSaveCoordinator.loadSnapshot('target', {
        content: '©!',
        revision: 'disk:utf8',
        status: 'success',
        text: DEFAULT_TEXT_METADATA,
      })
      return new Uint8Array([1])
    })
    const req = await request({ expectedSha256: null })
    expect(await cliReceipt(req, () => runCliRequest(req))).toMatchObject({
      ok: false,
      code: 'content_changed',
    })
    expect(mocks.invoke.mock.calls.some(([command]) => command === 'cli_write_export')).toBe(false)
  })

  it('does not substitute a different live draft for the default disk digest', async () => {
    loadGbk()
    mocks.content = 'unsaved draft'
    expect(
      await runCliRequest(
        await request({ operation: 'wait', waitFor: 'visible', expectedSha256: null }),
      ),
    ).toMatchObject({
      code: 'file_visible',
      result: { applied: false, expectedSha256: await contentSha256('漏!') },
    })
    expect(mocks.refresh).not.toHaveBeenCalled()
  })

  it('reports a snapshot decoding failure instead of waiting until timeout', async () => {
    loadGbk()
    const invoke = mocks.invoke.getMockImplementation()!
    mocks.invoke.mockImplementation((command, args) => {
      if (command === 'cli_hash_snapshot') throw new Error('Invalid GBK data')
      return invoke(command, args)
    })
    const req = await request({ operation: 'wait', expectedSha256: null })
    expect(await cliReceipt(req, () => runCliRequest(req))).toMatchObject({
      ok: false,
      code: 'file_unavailable',
      message: 'Error: Invalid GBK data',
    })
  })

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

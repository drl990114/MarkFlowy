import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as DraftRecoveryState from '@/services/draftRecoveryState'
import type { switchWorkspaceInCurrentWindow } from '@/services/workspace-switch'
import type * as AppSetup from './useAppSetup'
import { normalizeStartupAppearance } from '@/startup/appearance'

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  emitTo: vi.fn(),
  flush: vi.fn(),
  switchSession: vi.fn(),
  attachSession: vi.fn(),
  confirm: vi.fn(),
  listenCli: vi.fn(),
  stopCli: vi.fn(),
  interactive: vi.fn(),
  afterInteractive: vi.fn<(task: () => void) => () => void>(),
  checkUpdate: vi.fn(),
  syncSystemTheme: vi.fn(),
  stageRecovery: vi.fn(),
  readSession: vi.fn(),
  restoreDocuments: vi.fn(),
  restoreWorkspace: vi.fn(),
  sessionReload: vi.fn(),
  closeNative: vi.fn(),
  closeDrafts: vi.fn<(cache: unknown, label: string, close: () => Promise<void>) => Promise<boolean>>(),
  closeRequested: async () => {},
  openExternalPaths: vi.fn(),
  opened: [] as string[],
  paths: {} as Record<string, string | undefined>,
  windowLabel: 'main',
  settingData: { auto_update: false },
  error: vi.fn(),
  getRootPath: vi.fn<() => string | undefined>(() => '/one'),
  cache: { flush: vi.fn(), dispose: vi.fn() },
}))

vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }))
vi.mock('@tauri-apps/api/webview', () => ({ getCurrentWebview: vi.fn() }))
vi.mock('@tauri-apps/plugin-store', () => ({
  LazyStore: class { init = async () => {}; get = async () => undefined },
}))
vi.mock('@/services/windows', () => ({
  currentWindow: {
    get label() { return mocks.windowLabel },
    emitTo: mocks.emitTo,
    listen: async (event: string, handler: () => Promise<void>) => {
      if (event === 'tauri://close-requested') mocks.closeRequested = handler
      return vi.fn()
    },
  },
}))
vi.mock('@/helper/logger', () => ({ logger: { debug: vi.fn(), error: mocks.error } }))
vi.mock('@/helper/files', () => ({ getFileObject: (id: string) => ({ id, name: `${id}.md`, path: mocks.paths[id] }) }))
vi.mock('@/helper/filesys', () => ({ getFileNameFromPath: vi.fn(), releaseSecurityScope: vi.fn() }))
vi.mock('@/helper/updater', () => ({ checkUpdate: mocks.checkUpdate }))
vi.mock('@/i18n', () => ({ i18nInit: vi.fn(), t: (key: string) => key }))
vi.mock('zens', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/commands', () => ({
  commandRegistry: { onDidChangeCommands: () => ({ dispose: vi.fn() }) },
}))
vi.mock('@/themes/library', () => ({ startThemeLibrary: vi.fn() }))
vi.mock('@/stores/editorResumeStore', () => ({ flushEditorResumeStates: vi.fn() }))
vi.mock('@/stores', () => ({
  useEditorStore: { getState: () => ({ getRootPath: mocks.getRootPath, opened: mocks.opened }), subscribe: () => vi.fn() },
}))
vi.mock('@/stores/useAppSettingStore', () => ({
  default: { getState: () => ({ settingData: mocks.settingData }) },
}))
vi.mock('@/stores/useOpenedCacheStore', () => ({
  default: { getState: () => ({ setRecentWorkspaces: vi.fn() }) },
}))
vi.mock('@/stores/useLayoutStore', () => ({
  default: { getState: () => ({ setWorkspaceContext: vi.fn(), openExplorer: vi.fn() }) },
}))
vi.mock('@/stores/useThemeStore', () => ({
  default: {
    getState: () => ({
      initFromSettings: vi.fn(),
      fallbackStaleStartupTheme: vi.fn(),
      syncSystemTheme: mocks.syncSystemTheme,
    }),
  },
}))
vi.mock('@/services/app-setting', () => ({ appSettingStoreSetup: async () => ({ theme_mode: 'system' }) }))
vi.mock('@/services/draft-recovery', () => ({
  listenForDraftReload: () => vi.fn(), closeWithDraftRecovery: mocks.closeDrafts,
}))
vi.mock('@/services/staged-draft-recovery', () => ({
  stageDraftRecovery: mocks.stageRecovery,
}))
vi.mock('@/services/dialog', () => ({ dialog: { confirm: mocks.confirm } }))
vi.mock('@/services/cli', () => ({ listenForCliRequests: mocks.listenCli }))
vi.mock('@/services/editor-file', () => ({ ensureDocument: vi.fn(), addExistingMarkdownFileEdit: vi.fn() }))
vi.mock('@/services/open-external-paths', () => ({ openExternalPaths: mocks.openExternalPaths }))
vi.mock('@/services/workspace-cache', () => ({ createWorkspaceCachePersistence: () => mocks.cache }))
vi.mock('@/services/window-session', () => ({
  createWindowSessionPersistence: () => ({ flush: mocks.flush, dispose: vi.fn() }),
  readWindowSession: mocks.readSession, restoreWindowDocuments: mocks.restoreDocuments,
  isWindowSessionReload: mocks.sessionReload,
}))
vi.mock('@/services/workspace-session', () => ({
  switchWorkspaceSession: mocks.switchSession, attachWorkspaceSession: mocks.attachSession,
  releaseDetachedWorkspaceScopes: vi.fn(),
}))
vi.mock('@/services/workspace-refresh', () => ({ refreshWorkspaceDirectory: vi.fn() }))
vi.mock('@/startup/restoreStartupWorkspace', () => ({ restoreStartupWorkspace: mocks.restoreWorkspace }))
vi.mock('@/startup/prepareEditor', () => ({
  prepareStartupEditorModules: async () => {}, prepareStartupDocumentRead: vi.fn(),
}))
vi.mock('@/startup/interactive', () => ({
  waitForStartupInteractive: mocks.interactive, afterStartupInteractive: mocks.afterInteractive,
}))
vi.mock('./useKeyboard', () => ({ default: vi.fn() }))
vi.mock('./useOSInfo', () => ({ default: vi.fn() }))
vi.mock('./useWorkspaceWatcher', () => ({ default: vi.fn() }))

let recovery: typeof DraftRecoveryState
let app: typeof AppSetup
let switchWorkspace: typeof switchWorkspaceInCurrentWindow
const releases: (() => void)[] = []

beforeEach(async () => {
  vi.resetModules()
  vi.resetAllMocks()
  window.openedUrls = []
  delete window.__MARKFLOWY_BOOTSTRAP__
  mocks.windowLabel = 'main'
  mocks.settingData.auto_update = false
  mocks.opened = []
  mocks.paths = {}
  mocks.stageRecovery.mockResolvedValue({ visibleReady: Promise.resolve(), finished: Promise.resolve(0) })
  mocks.sessionReload.mockReturnValue(false)
  mocks.closeDrafts.mockImplementation(async (_cache, _label, close) => { await close(); return true })
  mocks.afterInteractive.mockReturnValue(vi.fn())
  mocks.checkUpdate.mockResolvedValue(undefined)
  mocks.syncSystemTheme.mockResolvedValue(undefined)
  mocks.getRootPath.mockReturnValue('/one')
  mocks.invoke.mockImplementation(async (command) => {
    if (command === 'get_opened_cache') return { recent_workspaces: [] }
    if (command === 'close_session_window') return mocks.closeNative()
    return undefined
  })
  mocks.switchSession.mockResolvedValue(true)
  mocks.attachSession.mockResolvedValue(true)
  mocks.confirm.mockResolvedValue('cancel')
  mocks.listenCli.mockResolvedValue(mocks.stopCli)
  mocks.interactive.mockResolvedValue(undefined)
  recovery = await import('@/services/draftRecoveryState')
  // The real persistence flush also waits for recovery. This reproduces the
  // outer-entry ordering failure instead of testing only switchWorkspaceSession.
  mocks.flush.mockImplementation(recovery.waitForAllDraftRecovery)
  app = await import('./useAppSetup')
  switchWorkspace = (await import('@/services/workspace-switch')).switchWorkspaceInCurrentWindow
  await app.startAppSetup()
})

afterEach(() => {
  cleanup()
  releases.splice(0).forEach((release) => release())
})

function failedDraft(id = 'broken') {
  const attempt = vi.fn<() => Promise<void>>(async () => { throw new Error('history_corrupt') })
  const keep = vi.fn(async () => { release() })
  const release = recovery.registerDraftRecovery(id, attempt, undefined, keep)
  releases.push(release)
  return { attempt, keep, release }
}

async function startRuntime() {
  const hook = renderHook(() => app.useAppRuntimeSetup())
  await act(async () => {})
  return hook
}

function bootstrapSession(restoreSessionLabel: string | null) {
  window.__MARKFLOWY_BOOTSTRAP__ = {
    appearance: normalizeStartupAppearance({}),
    sessionId: 'app-session',
    openedUrls: [],
    restoreSessionLabel,
  }
}

describe('application window restoration', () => {
  it('restores the exact window snapshot before recovering its drafts', async () => {
    vi.resetModules()
    bootstrapSession('main_workspace')
    mocks.windowLabel = 'main_workspace'
    const session = { windowLabel: 'main_workspace', rootPath: '/workspace' }
    mocks.readSession.mockResolvedValue(session)
    await (await import('./useAppSetup')).startAppSetup()
    expect(mocks.readSession).toHaveBeenLastCalledWith(expect.anything(), 'main_workspace', 'main_workspace')
    expect(mocks.restoreWorkspace).toHaveBeenCalledWith('/workspace', expect.any(Promise), expect.any(AbortSignal))
    expect(mocks.restoreDocuments).toHaveBeenCalledWith(session)
    expect(mocks.stageRecovery).toHaveBeenLastCalledWith(expect.objectContaining({ session, freshWindow: false }))
    expect(mocks.restoreDocuments.mock.invocationCallOrder[0]).toBeLessThan(mocks.stageRecovery.mock.invocationCallOrder.at(-1)!)
  })

  it.each([null, 'main_missing'])('does not reopen the last workspace for an explicit native session (%s)', async (label) => {
    vi.resetModules()
    bootstrapSession(label)
    mocks.invoke.mockImplementation(async (command) => command === 'get_opened_cache'
      ? { recent_workspaces: [{ path: '/old-workspace' }] } : undefined)
    await (await import('./useAppSetup')).startAppSetup()
    expect(mocks.restoreWorkspace).not.toHaveBeenCalled()
    expect(mocks.stageRecovery).toHaveBeenLastCalledWith(expect.objectContaining({
      isolatedWindow: 'main', freshWindow: true,
    }))
  })

  it('allows WebView reload recovery in a window originally opened empty', async () => {
    vi.resetModules()
    bootstrapSession(null)
    mocks.sessionReload.mockReturnValue(true)
    mocks.readSession.mockResolvedValue({ windowLabel: 'main' })
    await (await import('./useAppSetup')).startAppSetup()
    expect(mocks.stageRecovery).toHaveBeenLastCalledWith(expect.objectContaining({ freshWindow: false }))
  })

  it('still recovers an explicitly opened file in a fresh window', async () => {
    vi.resetModules()
    bootstrapSession(null)
    mocks.getRootPath.mockReturnValue(undefined)
    window.openedUrls = ['/standalone.md']
    mocks.openExternalPaths.mockImplementation(async () => {
      mocks.opened = ['standalone']
      mocks.paths = { standalone: '/standalone.md' }
    })
    await (await import('./useAppSetup')).startAppSetup()
    expect(mocks.stageRecovery).toHaveBeenLastCalledWith(expect.objectContaining({
      freshWindow: false, reopenPaths: ['/standalone.md'], preserveOpenDocuments: true,
    }))
  })
})

describe('application quit cancellation', () => {
  it('clears a pending app quit when a window cancels close, and allows another close', async () => {
    await startRuntime()
    mocks.closeDrafts.mockResolvedValueOnce(false)
    await act(async () => { await mocks.closeRequested() })
    expect(mocks.invoke).toHaveBeenCalledWith('cancel_app_quit')
    expect(mocks.closeNative).not.toHaveBeenCalled()
    await act(async () => { await mocks.closeRequested() })
    expect(mocks.closeNative).toHaveBeenCalledOnce()
  })

  it('clears pending quit and keeps the window when its final persistence fails', async () => {
    await startRuntime()
    mocks.flush.mockRejectedValueOnce(new Error('disk full'))
    await act(async () => { await mocks.closeRequested() })
    expect(mocks.invoke).toHaveBeenCalledWith('cancel_app_quit')
    expect(mocks.closeNative).not.toHaveBeenCalled()
    expect(mocks.error).toHaveBeenCalledWith('Failed to close window safely', expect.any(Error))
  })

  it('allows retry when native session persistence or window teardown fails', async () => {
    await startRuntime()
    mocks.closeNative.mockRejectedValueOnce(new Error('could not preserve window list'))
    await act(async () => { await mocks.closeRequested() })
    expect(mocks.invoke).toHaveBeenCalledWith('cancel_app_quit')
    expect(mocks.error).toHaveBeenCalledWith('Failed to close window safely', expect.any(Error))
    await act(async () => { await mocks.closeRequested() })
    expect(mocks.closeNative).toHaveBeenCalledTimes(2)
  })

  it('coalesces repeated close requests until the protected close finishes', async () => {
    await startRuntime()
    let finish!: () => void
    mocks.closeDrafts.mockReturnValueOnce(new Promise<boolean>((resolve) => { finish = () => resolve(false) }))
    await act(async () => {
      const first = mocks.closeRequested()
      await Promise.resolve()
      const repeated = mocks.closeRequested()
      await vi.waitFor(() => expect(mocks.closeDrafts).toHaveBeenCalledOnce())
      finish()
      await Promise.all([first, repeated])
    })
    expect(mocks.invoke.mock.calls.filter(([command]) => command === 'cancel_app_quit')).toHaveLength(1)
  })
})

describe('explicit standalone startup recovery', () => {
  it.each(['main', 'main_reopened'])('scopes recovery to paths actually opened in %s', async (label) => {
    vi.resetModules()
    mocks.stageRecovery.mockClear()
    mocks.windowLabel = label
    mocks.getRootPath.mockReturnValue(undefined)
    window.openedUrls = ['/w/active.md', '/w/another-window.md']
    mocks.openExternalPaths.mockImplementation(async () => {
      mocks.opened = ['active', 'untitled']
      mocks.paths = { active: '/w/active.md' }
    })
    await (await import('./useAppSetup')).startAppSetup()
    expect(mocks.stageRecovery).toHaveBeenCalledOnce()
    expect(mocks.stageRecovery).toHaveBeenCalledWith(expect.objectContaining({
      isolatedWindow: label, reopenPaths: ['/w/active.md'],
      preserveOpenDocuments: true, session: undefined,
    }))
  })

  it('does not broaden recovery for a workspace startup', async () => {
    vi.resetModules()
    mocks.stageRecovery.mockClear()
    window.openedUrls = ['/one']
    mocks.opened = ['active']
    mocks.paths = { active: '/one/active.md' }
    await (await import('./useAppSetup')).startAppSetup()
    expect(mocks.stageRecovery).toHaveBeenCalledWith(expect.objectContaining({
      isolatedWindow: undefined, reopenPaths: undefined, preserveOpenDocuments: true,
    }))
  })

  it('keeps secondary startup without explicit paths owner-isolated', async () => {
    vi.resetModules()
    mocks.stageRecovery.mockClear()
    mocks.windowLabel = 'main_blank'
    mocks.getRootPath.mockReturnValue(undefined)
    mocks.opened = ['active']
    mocks.paths = { active: '/w/active.md' }
    await (await import('./useAppSetup')).startAppSetup()
    expect(mocks.stageRecovery).toHaveBeenCalledWith(expect.objectContaining({
      isolatedWindow: 'main_blank', reopenPaths: undefined, preserveOpenDocuments: false,
    }))
  })
})

describe('deferred startup updates', () => {
  it.each([false, true])('checks once in the main window after startup is interactive (automatic: %s)', async (automatic) => {
    mocks.settingData.auto_update = automatic
    const first = await startRuntime()
    expect(mocks.checkUpdate).not.toHaveBeenCalled()
    await act(async () => { mocks.afterInteractive.mock.calls[0][0]() })
    expect(mocks.checkUpdate).toHaveBeenCalledExactlyOnceWith({ install: automatic })
    first.unmount()

    await startRuntime()
    await act(async () => { mocks.afterInteractive.mock.calls[1][0]() })
    expect(mocks.checkUpdate).toHaveBeenCalledOnce()
  })

  it('keeps secondary-window setup active without repeating updater recovery or installation', async () => {
    mocks.windowLabel = 'main_second'
    mocks.settingData.auto_update = true
    await startRuntime()
    await act(async () => { mocks.afterInteractive.mock.calls[0][0]() })

    expect(mocks.syncSystemTheme).toHaveBeenCalledOnce()
    expect(mocks.listenCli).toHaveBeenCalledOnce()
    expect(mocks.checkUpdate).not.toHaveBeenCalled()
  })
})

describe('workspace switching with failed recovery', () => {
  it.each(['/two', undefined])('allows cancellation before flushing the current session (%s)', async (path) => {
    const draft = failedDraft()
    await expect(switchWorkspace(path)).resolves.toBe(false)
    expect(mocks.confirm).toHaveBeenCalledOnce()
    expect(mocks.flush).not.toHaveBeenCalled()
    expect(mocks.switchSession).not.toHaveBeenCalled()
    expect(mocks.attachSession).not.toHaveBeenCalled()
    expect(draft.keep).not.toHaveBeenCalled()
    expect(recovery.isDraftRecoveryPending('broken')).toBe(true)
  })

  it.each(['retry', 'keep'])('resolves recovery before capturing the old session (%s)', async (action) => {
    const draft = failedDraft()
    mocks.confirm.mockImplementation(async () => {
      expect(mocks.flush).not.toHaveBeenCalled()
      if (action === 'retry') draft.attempt.mockImplementation(async () => { draft.release() })
      return action
    })
    await expect(switchWorkspace('/two')).resolves.toBe(true)
    expect(mocks.flush).toHaveBeenCalledOnce()
    expect(mocks.switchSession).toHaveBeenCalledWith('/two', mocks.cache)
    expect(mocks.flush.mock.invocationCallOrder[0]).toBeLessThan(mocks.switchSession.mock.invocationCallOrder[0])
    expect(recovery.isDraftRecoveryPending('broken')).toBe(false)
  })

  it('focuses an existing workspace window without touching local failed drafts', async () => {
    const draft = failedDraft()
    mocks.invoke.mockResolvedValue('other-window')
    await expect(switchWorkspace('/two')).resolves.toBe(false)
    expect(mocks.invoke).toHaveBeenCalledWith('focus_window_by_label', { windowLabel: 'other-window' })
    expect(draft.attempt).not.toHaveBeenCalled()
    expect(mocks.confirm).not.toHaveBeenCalled()
    expect(mocks.flush).not.toHaveBeenCalled()
  })

  it('keeps the current workspace when persisting retained drafts fails', async () => {
    const draft = failedDraft()
    draft.keep.mockRejectedValue(new Error('disk full'))
    mocks.confirm.mockResolvedValue('keep')
    await expect(switchWorkspace('/two')).resolves.toBe(false)
    expect(recovery.isDraftRecoveryPending('broken')).toBe(true)
    expect(mocks.flush).not.toHaveBeenCalled()
    expect(mocks.switchSession).not.toHaveBeenCalled()
  })
})

describe('CLI startup after failed recovery', () => {
  it.each(['retry', 'keep'])('connects once after the user resolves every failed draft (%s)', async (action) => {
    const first = failedDraft('first')
    const second = failedDraft('second')
    const { unmount } = await startRuntime()
    expect(first.attempt).toHaveBeenCalledOnce()
    expect(second.attempt).toHaveBeenCalledOnce()
    expect(mocks.listenCli).not.toHaveBeenCalled()
    const resolveDraft = async (id: string, draft: ReturnType<typeof failedDraft>) => {
      if (action === 'keep') await recovery.keepDraftRecoveryAndClose(id)
      else {
        draft.attempt.mockImplementation(async () => { draft.release() })
        await recovery.waitForDraftRecovery(id)
      }
    }
    await act(async () => { await resolveDraft('first', first) })
    expect(mocks.listenCli).not.toHaveBeenCalled()
    expect(second.attempt).toHaveBeenCalledOnce()
    await act(async () => { await resolveDraft('second', second) })
    expect(mocks.listenCli).toHaveBeenCalledOnce()
    expect(recovery.draftRecoveryCompletion('second')).toBe(action === 'retry' ? 1 : 0)
    // Release and successful-recovery notifications must not duplicate listeners.
    await act(async () => { second.release(); await recovery.waitForAllDraftRecovery() })
    expect(mocks.listenCli).toHaveBeenCalledOnce()
    unmount()
    expect(mocks.stopCli).toHaveBeenCalledOnce()
  })

  it('keeps failures gated without automatically retrying them', async () => {
    const draft = failedDraft()
    await startRuntime()
    await act(async () => {
      await recovery.waitForDraftRecovery('broken').catch(() => undefined)
    })
    expect(draft.attempt).toHaveBeenCalledTimes(2)
    expect(mocks.listenCli).not.toHaveBeenCalled()
    expect(mocks.error).toHaveBeenCalled()
  })

  it('waits for the startup interactive gate even if recovery is resolved earlier', async () => {
    let interactive!: () => void
    mocks.interactive.mockReturnValue(new Promise<void>((resolve) => { interactive = resolve }))
    const draft = failedDraft()
    await startRuntime()
    await act(async () => { await recovery.keepDraftRecoveryAndClose('broken') })
    expect(draft.attempt).not.toHaveBeenCalled()
    expect(mocks.listenCli).not.toHaveBeenCalled()
    await act(async () => { interactive() })
    expect(mocks.listenCli).toHaveBeenCalledOnce()
  })

  it('stops waiting when unmounted before the failed draft is resolved', async () => {
    failedDraft()
    const { unmount } = await startRuntime()
    unmount()
    await act(async () => { await recovery.keepDraftRecoveryAndClose('broken') })
    expect(mocks.listenCli).not.toHaveBeenCalled()
  })

  it('does not recover drafts or register a listener after an early unmount', async () => {
    let interactive!: () => void
    mocks.interactive.mockReturnValue(new Promise<void>((resolve) => { interactive = resolve }))
    const draft = failedDraft()
    const { unmount } = await startRuntime()
    unmount()
    await act(async () => { interactive() })
    expect(draft.attempt).not.toHaveBeenCalled()
    expect(mocks.listenCli).not.toHaveBeenCalled()
  })

  it('stays gated when keeping a draft fails, then connects after a successful keep', async () => {
    const draft = failedDraft()
    draft.keep.mockRejectedValueOnce(new Error('disk full'))
    await startRuntime()
    await act(async () => {
      await expect(recovery.keepDraftRecoveryAndClose('broken')).rejects.toThrow('disk full')
    })
    expect(recovery.isDraftRecoveryPending('broken')).toBe(true)
    expect(mocks.listenCli).not.toHaveBeenCalled()
    await act(async () => { await recovery.keepDraftRecoveryAndClose('broken') })
    expect(mocks.listenCli).toHaveBeenCalledOnce()
  })

  it('cleans up a listener whose native registration finishes after unmount', async () => {
    let register!: (stop: () => void) => void
    mocks.listenCli.mockReturnValue(new Promise<() => void>((resolve) => { register = resolve }))
    const { unmount } = await startRuntime()
    expect(mocks.listenCli).toHaveBeenCalledOnce()
    unmount()
    await act(async () => { register(mocks.stopCli) })
    expect(mocks.stopCli).toHaveBeenCalledOnce()
  })
})

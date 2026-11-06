import type { Update } from '@tauri-apps/plugin-updater'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import useUpdaterStore from '@/stores/useUpdaterStore'
import { checkUpdate, fetchUpdate, installUpdate } from './updater'

const mocks = vi.hoisted(() => ({
  preserveSession: vi.fn(),
  info: vi.fn(),
  check: vi.fn(),
  confirm: vi.fn(),
  invoke: vi.fn(),
  loading: vi.fn(() => 'update-toast'),
  dismiss: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  logError: vi.fn(),
  osType: vi.fn(),
  getVersion: vi.fn(),
  writeSettingPatch: vi.fn(),
  getAttempt: vi.fn(),
  setAttempt: vi.fn(),
  deleteAttempt: vi.fn(),
  saveAttempt: vi.fn(),
  reloadAttempt: vi.fn(),
  attempt: undefined as unknown,
  savedAttempt: undefined as unknown,
}))

vi.mock('@/services/update-session', () => ({
  withPreservedUpdateSession: async (label: string, operation: () => Promise<unknown>) => {
    await mocks.preserveSession(label)
    return operation()
  },
}))
vi.mock('@/services/windows', () => ({ currentWindow: { label: 'main' } }))
vi.mock('@tauri-apps/plugin-updater', () => ({ check: mocks.check }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }))
vi.mock('@tauri-apps/api/app', () => ({ getVersion: mocks.getVersion }))
vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: async () => '/app-data',
  join: async (...parts: string[]) => parts.join('/'),
}))
vi.mock('@tauri-apps/plugin-os', () => ({ type: mocks.osType }))
vi.mock('@tauri-apps/plugin-store', () => ({
  LazyStore: class {
    get = mocks.getAttempt
    set = mocks.setAttempt
    delete = mocks.deleteAttempt
    save = mocks.saveAttempt
    reload = mocks.reloadAttempt
  },
}))
vi.mock('@/services/app-setting', () => ({ writeSettingPatch: mocks.writeSettingPatch }))
vi.mock('@/services/dialog', () => ({ dialog: { confirm: mocks.confirm } }))
vi.mock('@/i18n', () => ({ i18n: { t: (key: string) => key, language: 'en' } }))
vi.mock('@/components/UpdateDialogContent', () => ({ UpdateDialogContent: () => null }))
vi.mock('./logger', () => ({ logger: { error: mocks.logError } }))
vi.mock('zens', () => ({
  toast: {
    info: mocks.info,
    loading: mocks.loading,
    dismiss: mocks.dismiss,
    success: mocks.success,
    error: mocks.error,
  },
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function createUpdate(version = '1.0.0') {
  return {
    currentVersion: '0.9.0',
    version,
    download: vi.fn<Update['download']>().mockResolvedValue(undefined),
    install: vi.fn<Update['install']>().mockResolvedValue(undefined),
    downloadAndInstall: vi.fn<Update['downloadAndInstall']>().mockResolvedValue(undefined),
    close: vi.fn<Update['close']>().mockResolvedValue(undefined),
  } as unknown as Update
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.preserveSession.mockReset().mockResolvedValue(undefined)
  mocks.check.mockReset()
  mocks.invoke.mockReset()
  mocks.confirm.mockReset().mockResolvedValue('cancel')
  mocks.osType.mockReset().mockReturnValue('macos')
  mocks.getVersion.mockReset().mockResolvedValue('0.9.0')
  mocks.writeSettingPatch.mockReset().mockResolvedValue(undefined)
  mocks.attempt = undefined
  mocks.savedAttempt = undefined
  mocks.reloadAttempt.mockReset().mockResolvedValue(undefined)
  mocks.getAttempt.mockReset().mockImplementation(async () => mocks.attempt)
  mocks.setAttempt.mockReset().mockImplementation(async (_key: string, value: unknown) => {
    mocks.attempt = value
  })
  mocks.deleteAttempt.mockReset().mockImplementation(async () => {
    mocks.attempt = undefined
    return true
  })
  mocks.saveAttempt.mockReset().mockImplementation(async () => {
    mocks.savedAttempt = structuredClone(mocks.attempt)
  })
  useUpdaterStore.setState({ update: null, isInstalling: false, installedVersion: null })
})

describe('Windows update recovery', () => {
  beforeEach(() => {
    mocks.osType.mockReturnValue('windows')
  })

  it('downloads before recording the attempt and waits for disk before launching the installer', async () => {
    const update = createUpdate()
    const download = deferred<void>()
    const saved = deferred<void>()
    vi.mocked(update.download).mockReturnValue(download.promise)
    mocks.saveAttempt.mockReturnValue(saved.promise)

    const installing = installUpdate(update)
    await vi.waitFor(() => expect(update.download).toHaveBeenCalledOnce())
    expect(mocks.setAttempt).not.toHaveBeenCalled()
    download.resolve()
    await vi.waitFor(() => expect(mocks.saveAttempt).toHaveBeenCalledOnce())
    expect(mocks.setAttempt).toHaveBeenCalledWith('pending_install', {
      fromVersion: update.currentVersion,
      targetVersion: update.version,
      startedAt: expect.any(Number),
    })
    expect(update.install).not.toHaveBeenCalled()
    saved.resolve()
    await installing

    expect(update.install).toHaveBeenCalledOnce()
    expect(update.downloadAndInstall).not.toHaveBeenCalled()
    expect(mocks.deleteAttempt).not.toHaveBeenCalled()
  })

  it('waits for every window session before launching the installer', async () => {
    const update = createUpdate()
    const saved = deferred<void>()
    mocks.preserveSession.mockReturnValue(saved.promise)
    const installing = installUpdate(update)
    await vi.waitFor(() => expect(mocks.preserveSession).toHaveBeenCalledWith('main'))
    expect(update.install).not.toHaveBeenCalled()
    expect(mocks.setAttempt).not.toHaveBeenCalled()
    saved.resolve()
    await installing
    expect(update.install).toHaveBeenCalledOnce()
  })

  it('leaves the application running when session preservation fails', async () => {
    const update = createUpdate()
    mocks.preserveSession.mockRejectedValue(new Error('disk full'))
    await installUpdate(update)
    expect(update.install).not.toHaveBeenCalled()
    expect(mocks.setAttempt).not.toHaveBeenCalled()
    expect(mocks.error).toHaveBeenCalledWith('updater.install_failed')
  })

  it('does not create an install attempt when the download fails', async () => {
    const update = createUpdate()
    vi.mocked(update.download).mockRejectedValue(new Error('offline'))

    await installUpdate(update)

    expect(update.install).not.toHaveBeenCalled()
    expect(mocks.setAttempt).not.toHaveBeenCalled()
    expect(useUpdaterStore.getState().isInstalling).toBe(false)
  })

  it.each(['set', 'save'])('does not launch the installer when %s fails', async (operation) => {
    const update = createUpdate()
    const failingOperation = operation === 'set' ? mocks.setAttempt : mocks.saveAttempt
    failingOperation.mockRejectedValueOnce(new Error('disk full'))

    await installUpdate(update)

    expect(update.install).not.toHaveBeenCalled()
    expect(mocks.error).toHaveBeenCalledWith('updater.install_failed')
    expect(useUpdaterStore.getState()).toMatchObject({
      isInstalling: false,
      installedVersion: null,
    })
  })

  it('keeps the attempt after an installer launch failure and permits a manual retry', async () => {
    const update = createUpdate()
    vi.mocked(update.install).mockRejectedValueOnce(new Error('launch cancelled'))

    await installUpdate(update)

    expect(mocks.savedAttempt).toMatchObject({ targetVersion: update.version })
    expect(mocks.deleteAttempt).not.toHaveBeenCalled()
    expect(useUpdaterStore.getState().installedVersion).toBeNull()

    await installUpdate(update)
    expect(update.install).toHaveBeenCalledTimes(2)
    expect(mocks.saveAttempt).toHaveBeenCalledTimes(2)
  })

})

describe('fetchUpdate', () => {
  it('shares concurrent checks and reuses the available resource for the same version', async () => {
    const pendingCheck = deferred<Update | null>()
    const update = createUpdate()
    mocks.check.mockReturnValue(pendingCheck.promise)

    const first = fetchUpdate()
    const second = fetchUpdate()
    expect(second).toBe(first)
    expect(mocks.check).toHaveBeenCalledTimes(1)

    pendingCheck.resolve(update)
    expect(await first).toBe(update)
    const refreshedUpdate = createUpdate()
    mocks.check.mockResolvedValue(refreshedUpdate)
    expect(await fetchUpdate()).toBe(update)
    expect(useUpdaterStore.getState().update).toBe(update)
    expect(mocks.check).toHaveBeenCalledTimes(2)
    expect(refreshedUpdate.close).toHaveBeenCalledOnce()
    expect(update.close).not.toHaveBeenCalled()
  })

  it('publishes an update found by the fallback check', async () => {
    const update = createUpdate()
    mocks.check.mockRejectedValueOnce(new Error('custom header rejected')).mockResolvedValue(update)

    expect(await fetchUpdate()).toBe(update)
    expect(mocks.check).toHaveBeenCalledTimes(2)
    expect(mocks.check).toHaveBeenLastCalledWith()
    expect(useUpdaterStore.getState().update).toBe(update)
    expect(mocks.error).not.toHaveBeenCalled()
  })

  it('handles check failures and allows a later retry', async () => {
    mocks.check.mockRejectedValue(new Error('offline'))

    expect(await fetchUpdate()).toBeNull()
    expect(mocks.error).toHaveBeenCalledOnce()
    expect(mocks.error).toHaveBeenCalledWith('updater.check_failed')

    const update = createUpdate()
    mocks.check.mockResolvedValue(update)
    expect(await fetchUpdate()).toBe(update)
  })

  it('keeps the currently installing resource when an earlier check resolves', async () => {
    const pendingCheck = deferred<Update | null>()
    const pendingInstall = deferred<void>()
    const installingUpdate = createUpdate()
    const extraUpdate = createUpdate()
    mocks.check.mockReturnValue(pendingCheck.promise)
    vi.mocked(installingUpdate.install).mockReturnValue(pendingInstall.promise)

    const checking = fetchUpdate()
    const installing = installUpdate(installingUpdate)
    pendingCheck.resolve(extraUpdate)

    expect(await checking).toBe(installingUpdate)
    expect(extraUpdate.close).toHaveBeenCalledOnce()
    expect(installingUpdate.close).not.toHaveBeenCalled()
    expect(useUpdaterStore.getState().isInstalling).toBe(true)

    pendingInstall.resolve()
    await installing
  })

  it('discards a late check result after installation has succeeded', async () => {
    const pendingCheck = deferred<Update | null>()
    const installedUpdate = createUpdate()
    const extraUpdate = createUpdate()
    mocks.check.mockReturnValue(pendingCheck.promise)

    const checking = fetchUpdate()
    await installUpdate(installedUpdate)
    pendingCheck.resolve(extraUpdate)

    expect(await checking).toBeNull()
    expect(extraUpdate.close).toHaveBeenCalledOnce()
    expect(useUpdaterStore.getState().update).toBeNull()
  })
})

describe('installUpdate', () => {
  it.each(['windows', 'macos', 'linux'])('finishes downloading on %s before protecting editors', async (os) => {
    mocks.osType.mockReturnValue(os)
    const update = createUpdate()
    const downloaded = deferred<void>()
    vi.mocked(update.download).mockReturnValue(downloaded.promise)
    const installing = installUpdate(update)
    await vi.waitFor(() => expect(update.download).toHaveBeenCalledOnce())
    expect(mocks.preserveSession).not.toHaveBeenCalled()
    expect(update.install).not.toHaveBeenCalled()
    downloaded.resolve()
    await installing
    expect(mocks.preserveSession).toHaveBeenCalledWith('main')
    expect(update.install).toHaveBeenCalledOnce()
    expect(update.downloadAndInstall).not.toHaveBeenCalled()
  })

  it('downloads once, clears the available update, and preserves the restart action', async () => {
    const update = createUpdate()
    const pendingInstall = deferred<void>()
    vi.mocked(update.install).mockReturnValue(pendingInstall.promise)
    useUpdaterStore.setState({ update })

    const first = installUpdate(update)
    const second = installUpdate(update)
    expect(second).toBe(first)
    expect(useUpdaterStore.getState().isInstalling).toBe(true)
    expect(await fetchUpdate()).toBe(update)
    await vi.waitFor(() => expect(update.install).toHaveBeenCalledOnce())

    pendingInstall.resolve()
    await first
    expect(useUpdaterStore.getState()).toMatchObject({
      update: null,
      isInstalling: false,
      installedVersion: '1.0.0',
    })
    expect(update.close).toHaveBeenCalledOnce()
    expect(mocks.dismiss).toHaveBeenCalledWith('update-toast')
    expect(mocks.invoke).not.toHaveBeenCalled()
    const restartAction = mocks.success.mock.calls[0][1].action as { onClick: () => void }
    await restartAction.onClick()
    expect(mocks.invoke).toHaveBeenCalledWith('app_restart')

    await installUpdate(update)
    expect(await fetchUpdate()).toBeNull()
    expect(update.install).toHaveBeenCalledOnce()
    expect(mocks.check).not.toHaveBeenCalled()
  })

  it('retains a failed update and permits retrying it', async () => {
    const update = createUpdate()
    vi.mocked(update.install).mockRejectedValueOnce(new Error('download interrupted'))

    await installUpdate(update)
    expect(useUpdaterStore.getState()).toMatchObject({
      update,
      isInstalling: false,
      installedVersion: null,
    })
    expect(update.close).not.toHaveBeenCalled()
    expect(mocks.error).toHaveBeenCalledWith('updater.install_failed')

    await installUpdate(update)
    expect(update.install).toHaveBeenCalledTimes(2)
    expect(update.close).toHaveBeenCalledOnce()
    expect(useUpdaterStore.getState().update).toBeNull()
  })

  it('does not report an installed update as failed when resource cleanup fails', async () => {
    const update = createUpdate()
    vi.mocked(update.close).mockRejectedValue(new Error('resource cleanup failed'))

    await installUpdate(update)

    expect(useUpdaterStore.getState().installedVersion).toBe(update.version)
    expect(mocks.success).toHaveBeenCalledOnce()
    expect(mocks.error).not.toHaveBeenCalled()
  })

  it('does not restart when acquiring a fresh session barrier fails', async () => {
    await installUpdate(createUpdate())
    mocks.preserveSession.mockRejectedValueOnce(new Error('window still saving'))
    await mocks.success.mock.calls[0][1].action.onClick()
    expect(mocks.invoke).not.toHaveBeenCalled()
    expect(mocks.error).toHaveBeenCalledWith('updater.install_failed')
  })
})

describe('checkUpdate', () => {
  it('offers an update without downloading or opening a modal', async () => {
    const update = createUpdate()
    mocks.check.mockResolvedValue(update)
    await checkUpdate()
    expect(mocks.confirm).not.toHaveBeenCalled()
    expect(mocks.info).toHaveBeenCalledOnce()
    expect(update.downloadAndInstall).not.toHaveBeenCalled()
    expect(update.download).not.toHaveBeenCalled()
    expect(useUpdaterStore.getState().update).toBe(update)
    const options = mocks.info.mock.calls[0][1]
    options.action.onClick()
    await vi.waitFor(() => expect(update.install).toHaveBeenCalledOnce())
  })

  it('does not repeat the offer for the same release', async () => {
    mocks.check.mockResolvedValueOnce(createUpdate()).mockResolvedValueOnce(createUpdate())
    await checkUpdate()
    await checkUpdate()
    expect(mocks.info).toHaveBeenCalledOnce()
  })

  it('offers a newer release after a later check', async () => {
    mocks.check.mockResolvedValueOnce(createUpdate()).mockResolvedValueOnce(createUpdate('2.0.0'))
    await checkUpdate()
    await checkUpdate()
    expect(mocks.info).toHaveBeenCalledTimes(2)
  })

  it('does not install after an interrupted Windows attempt', async () => {
    mocks.osType.mockReturnValue('windows')
    mocks.attempt = { fromVersion: '0.9.0', targetVersion: '1.0.0', startedAt: 1 }
    const update = createUpdate()
    mocks.check.mockResolvedValue(update)
    await checkUpdate()
    expect(mocks.confirm).not.toHaveBeenCalled()
    expect(update.download).not.toHaveBeenCalled()
    expect(update.install).not.toHaveBeenCalled()
    expect(mocks.info).toHaveBeenCalledOnce()
  })
})

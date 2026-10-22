import type { Update } from '@tauri-apps/plugin-updater'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import useUpdaterStore from '@/stores/useUpdaterStore'
import { checkUpdate, fetchUpdate, installUpdate } from './updater'

const mocks = vi.hoisted(() => ({
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
  attempt: undefined as unknown,
  savedAttempt: undefined as unknown,
}))

vi.mock('@tauri-apps/plugin-updater', () => ({ check: mocks.check }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }))
vi.mock('@tauri-apps/api/app', () => ({ getVersion: mocks.getVersion }))
vi.mock('@tauri-apps/plugin-os', () => ({ type: mocks.osType }))
vi.mock('@tauri-apps/plugin-store', () => ({
  LazyStore: class {
    get = mocks.getAttempt
    set = mocks.setAttempt
    delete = mocks.deleteAttempt
    save = mocks.saveAttempt
  },
}))
vi.mock('@/services/app-setting', () => ({ writeSettingPatch: mocks.writeSettingPatch }))
vi.mock('@/services/dialog', () => ({ dialog: { confirm: mocks.confirm } }))
vi.mock('@/i18n', () => ({ i18n: { t: (key: string) => key, language: 'en' } }))
vi.mock('@/components/UpdateDialogContent', () => ({ UpdateDialogContent: () => null }))
vi.mock('./logger', () => ({ logger: { error: mocks.logError } }))
vi.mock('zens', () => ({
  toast: {
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
  mocks.check.mockReset()
  mocks.confirm.mockReset().mockResolvedValue('cancel')
  mocks.osType.mockReset().mockReturnValue('macos')
  mocks.getVersion.mockReset().mockResolvedValue('0.9.0')
  mocks.writeSettingPatch.mockReset().mockResolvedValue(undefined)
  mocks.attempt = undefined
  mocks.savedAttempt = undefined
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

  const previousAttempt = () => ({
    fromVersion: '0.9.0',
    targetVersion: '1.0.0',
    startedAt: 1,
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

  it('does not automatically retry after a new renderer starts at the old version', async () => {
    const update = createUpdate()
    await installUpdate(update)
    expect(mocks.savedAttempt).toMatchObject({ fromVersion: '0.9.0' })

    // Only the on-disk marker survives the app exiting inside the native installer.
    mocks.attempt = structuredClone(mocks.savedAttempt)
    vi.resetModules()
    const restartedUpdater = await import('./updater')
    const { default: restartedStore } = await import('@/stores/useUpdaterStore')
    mocks.check.mockResolvedValue(createUpdate())

    await restartedUpdater.checkUpdate({ install: true })

    expect(mocks.check).not.toHaveBeenCalled()
    expect(mocks.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'updater.interrupted_title',
        actions: expect.arrayContaining([expect.objectContaining({ id: 'disable' })]),
      }),
    )
    expect(restartedStore.getState().isInstalling).toBe(false)
    expect(mocks.savedAttempt).toMatchObject({ targetVersion: '1.0.0' })
  })

  it('keeps recovery available across repeated cancelled startup prompts', async () => {
    mocks.attempt = previousAttempt()
    mocks.check.mockResolvedValue(createUpdate())

    await checkUpdate({ install: true })
    await checkUpdate({ install: true })

    expect(mocks.confirm).toHaveBeenCalledTimes(2)
    expect(mocks.check).not.toHaveBeenCalled()
    expect(mocks.deleteAttempt).not.toHaveBeenCalled()
    expect(mocks.writeSettingPatch).not.toHaveBeenCalled()
  })

  it('disables automatic updates before clearing recovery, without needing the network', async () => {
    mocks.attempt = previousAttempt()
    mocks.confirm.mockResolvedValue('disable')
    const settingSaved = deferred<void>()
    mocks.writeSettingPatch.mockReturnValue(settingSaved.promise)

    const checking = checkUpdate({ install: true })
    await vi.waitFor(() =>
      expect(mocks.writeSettingPatch).toHaveBeenCalledWith({ auto_update: false }),
    )
    expect(mocks.deleteAttempt).not.toHaveBeenCalled()
    settingSaved.resolve()
    await checking

    expect(mocks.savedAttempt).toBeUndefined()
    expect(mocks.deleteAttempt).toHaveBeenCalledOnce()
    expect(mocks.check).not.toHaveBeenCalled()
  })

  it('retains recovery when disabling automatic updates cannot be saved', async () => {
    mocks.attempt = previousAttempt()
    mocks.confirm.mockResolvedValue('disable')
    mocks.writeSettingPatch.mockRejectedValue(new Error('disk full'))

    await checkUpdate({ install: true })

    expect(mocks.deleteAttempt).not.toHaveBeenCalled()
    expect(mocks.check).not.toHaveBeenCalled()
    expect(mocks.error).toHaveBeenCalledWith('updater.check_failed')
  })

  it('rechecks and installs only after an explicit retry', async () => {
    mocks.attempt = previousAttempt()
    mocks.confirm.mockResolvedValue('retry')
    const update = createUpdate('1.1.0')
    mocks.check.mockResolvedValue(update)

    await checkUpdate({ install: true })

    expect(update.install).toHaveBeenCalledOnce()
    expect(mocks.savedAttempt).toMatchObject({ targetVersion: '1.1.0' })
    expect(mocks.writeSettingPatch).not.toHaveBeenCalled()
  })

  it.each(['1.0.0', '1.1.0'])(
    'clears the obsolete attempt after starting version %s',
    async (version) => {
      mocks.attempt = previousAttempt()
      mocks.getVersion.mockResolvedValue(version)
      mocks.check.mockResolvedValue(null)

      await checkUpdate({ install: true })

      expect(mocks.deleteAttempt).toHaveBeenCalledOnce()
      expect(mocks.saveAttempt).toHaveBeenCalledOnce()
      expect(mocks.check).toHaveBeenCalledOnce()
      expect(mocks.confirm).not.toHaveBeenCalled()
      expect(mocks.writeSettingPatch).not.toHaveBeenCalled()
    },
  )

  it('fails closed when recovery cannot be read', async () => {
    mocks.getAttempt.mockRejectedValue(new Error('store unavailable'))
    mocks.check.mockResolvedValue(createUpdate())

    await checkUpdate({ install: true })

    expect(mocks.check).not.toHaveBeenCalled()
    expect(mocks.error).toHaveBeenCalledWith('updater.check_failed')
  })

  it('restores the recovery record in memory if clearing it cannot be saved', async () => {
    mocks.attempt = previousAttempt()
    mocks.savedAttempt = structuredClone(mocks.attempt)
    mocks.getVersion.mockResolvedValue('1.0.0')
    mocks.saveAttempt.mockRejectedValueOnce(new Error('disk full'))

    await checkUpdate({ install: true })

    expect(mocks.attempt).toEqual(previousAttempt())
    expect(mocks.savedAttempt).toEqual(previousAttempt())
    expect(mocks.check).not.toHaveBeenCalled()
    expect(mocks.error).toHaveBeenCalledWith('updater.check_failed')
  })

  it('fails closed when the stored recovery record is invalid', async () => {
    mocks.attempt = { targetVersion: '1.0.0' }

    await checkUpdate({ install: true })

    expect(mocks.check).not.toHaveBeenCalled()
    expect(mocks.deleteAttempt).not.toHaveBeenCalled()
    expect(mocks.error).toHaveBeenCalledWith('updater.check_failed')
  })

  it.each(['macos', 'linux'])('preserves the existing %s installation flow', async (osType) => {
    mocks.osType.mockReturnValue(osType)
    const update = createUpdate()
    mocks.check.mockResolvedValue(update)

    await checkUpdate({ install: true })

    expect(update.downloadAndInstall).toHaveBeenCalledOnce()
    expect(update.install).not.toHaveBeenCalled()
    expect(mocks.getAttempt).not.toHaveBeenCalled()
    expect(mocks.setAttempt).not.toHaveBeenCalled()
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
    vi.mocked(installingUpdate.downloadAndInstall).mockReturnValue(pendingInstall.promise)

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
  it('downloads once, clears the available update, and preserves the restart action', async () => {
    const update = createUpdate()
    const pendingInstall = deferred<void>()
    vi.mocked(update.downloadAndInstall).mockReturnValue(pendingInstall.promise)
    useUpdaterStore.setState({ update })

    const first = installUpdate(update)
    const second = installUpdate(update)
    expect(second).toBe(first)
    expect(useUpdaterStore.getState().isInstalling).toBe(true)
    expect(await fetchUpdate()).toBe(update)
    expect(update.downloadAndInstall).toHaveBeenCalledOnce()

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
    restartAction.onClick()
    expect(mocks.invoke).toHaveBeenCalledWith('app_restart')

    await installUpdate(update)
    expect(await fetchUpdate()).toBeNull()
    expect(update.downloadAndInstall).toHaveBeenCalledOnce()
    expect(mocks.check).not.toHaveBeenCalled()
  })

  it('retains a failed update and permits retrying it', async () => {
    const update = createUpdate()
    vi.mocked(update.downloadAndInstall).mockRejectedValueOnce(new Error('download interrupted'))

    await installUpdate(update)
    expect(useUpdaterStore.getState()).toMatchObject({
      update,
      isInstalling: false,
      installedVersion: null,
    })
    expect(update.close).not.toHaveBeenCalled()
    expect(mocks.error).toHaveBeenCalledWith('updater.install_failed')

    await installUpdate(update)
    expect(update.downloadAndInstall).toHaveBeenCalledTimes(2)
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
})

describe('checkUpdate', () => {
  it('keeps a declined startup update available for the title bar', async () => {
    const update = createUpdate()
    mocks.check.mockResolvedValue(update)

    await checkUpdate()

    expect(mocks.confirm).toHaveBeenCalledOnce()
    expect(useUpdaterStore.getState().update).toBe(update)
    expect(update.downloadAndInstall).not.toHaveBeenCalled()
    expect(update.close).not.toHaveBeenCalled()
  })

  it('keeps automatic installation enabled when requested', async () => {
    const update = createUpdate()
    mocks.check.mockResolvedValue(update)

    await checkUpdate({ install: true })

    expect(update.downloadAndInstall).toHaveBeenCalledOnce()
    expect(mocks.confirm).not.toHaveBeenCalled()
    expect(useUpdaterStore.getState().installedVersion).toBe(update.version)
  })

  it('does not reinstall a resource held by an earlier startup dialog', async () => {
    const update = createUpdate()
    const pendingDialog = deferred<string>()
    mocks.check.mockResolvedValue(update)
    mocks.confirm.mockReturnValue(pendingDialog.promise)

    const checking = checkUpdate()
    await vi.waitFor(() => expect(mocks.confirm).toHaveBeenCalledOnce())
    await installUpdate(update)
    pendingDialog.resolve('install')
    await checking

    expect(update.downloadAndInstall).toHaveBeenCalledOnce()
    expect(update.close).toHaveBeenCalledOnce()
  })

  it('installs the refreshed version when an older startup dialog is accepted', async () => {
    const oldUpdate = createUpdate('1.0.0')
    const latestUpdate = createUpdate('1.1.0')
    const pendingDialog = deferred<string>()
    mocks.check.mockResolvedValueOnce(oldUpdate).mockResolvedValueOnce(latestUpdate)
    mocks.confirm.mockReturnValue(pendingDialog.promise)

    const checking = checkUpdate()
    await vi.waitFor(() => expect(mocks.confirm).toHaveBeenCalledOnce())
    expect(await fetchUpdate()).toBe(latestUpdate)
    expect(useUpdaterStore.getState().update).toBe(latestUpdate)
    expect(oldUpdate.close).toHaveBeenCalledOnce()

    pendingDialog.resolve('install')
    await checking

    expect(oldUpdate.downloadAndInstall).not.toHaveBeenCalled()
    expect(latestUpdate.downloadAndInstall).toHaveBeenCalledOnce()
    expect(useUpdaterStore.getState().installedVersion).toBe('1.1.0')
  })

  it('does not use an old dialog resource after a refresh reports no update', async () => {
    const update = createUpdate()
    const pendingDialog = deferred<string>()
    mocks.check.mockResolvedValueOnce(update).mockResolvedValueOnce(null)
    mocks.confirm.mockReturnValue(pendingDialog.promise)

    const checking = checkUpdate()
    await vi.waitFor(() => expect(mocks.confirm).toHaveBeenCalledOnce())
    expect(await fetchUpdate()).toBeNull()
    expect(useUpdaterStore.getState().update).toBeNull()
    expect(update.close).toHaveBeenCalledOnce()

    pendingDialog.resolve('install')
    await checking

    expect(update.downloadAndInstall).not.toHaveBeenCalled()
    expect(useUpdaterStore.getState().installedVersion).toBeNull()
  })
})

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
}))

vi.mock('@tauri-apps/plugin-updater', () => ({ check: mocks.check }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }))
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
    version,
    downloadAndInstall: vi.fn<Update['downloadAndInstall']>().mockResolvedValue(undefined),
    close: vi.fn<Update['close']>().mockResolvedValue(undefined),
  } as unknown as Update
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.check.mockReset()
  mocks.confirm.mockReset().mockResolvedValue('cancel')
  useUpdaterStore.setState({ update: null, isInstalling: false, installedVersion: null })
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

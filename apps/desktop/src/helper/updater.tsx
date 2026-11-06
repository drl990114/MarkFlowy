import { withPreservedUpdateSession } from '@/services/update-session'
import { currentWindow } from '@/services/windows'
import { recordUpdateAttempt } from '@/services/update-recovery'
import useUpdaterStore from '@/stores/useUpdaterStore'
import { invoke } from '@tauri-apps/api/core'
import { type } from '@tauri-apps/plugin-os'
import type { Update } from '@tauri-apps/plugin-updater'
import { check } from '@tauri-apps/plugin-updater'
import { i18n } from '@/i18n'
import { toast } from 'zens'
import { logger } from './logger'

let checkPromise: Promise<Update | null> | undefined
let installPromise: Promise<void> | undefined
const releasedUpdates = new WeakSet<Update>()

const closeUpdate = async (update: Update) => {
  if (releasedUpdates.has(update)) return
  releasedUpdates.add(update)
  try {
    await update.close()
  } catch (error) {
    logger.error('Close update resource failed:', error)
  }
}

export const installUpdate = (update: Update): Promise<void> => {
  if (installPromise) return installPromise
  const state = useUpdaterStore.getState()
  if (state.installedVersion) return Promise.resolve()

  const currentUpdate = state.update ?? (releasedUpdates.has(update) ? null : update)
  if (!currentUpdate) return Promise.resolve()
  installPromise = Promise.resolve()
    .then(async () => {
      const id = toast.loading(i18n.t('updater.downloading'))

      try {
        // Download while editing remains available; only installation needs the session barrier.
        await currentUpdate.download()
        await withPreservedUpdateSession(currentWindow.label, async () => {
          if (type() === 'windows') await recordUpdateAttempt(currentUpdate)
          await currentUpdate.install()
        })
        useUpdaterStore.setState({ update: null, installedVersion: currentUpdate.version })
        await closeUpdate(currentUpdate)
        toast.dismiss(id)
        toast.success(i18n.t('updater.install_success'), {
          action: {
            label: i18n.t('updater.restart'),
            onClick: async () => {
              try {
                await withPreservedUpdateSession(currentWindow.label, () => invoke('app_restart'))
              } catch (error) {
                toast.error(i18n.t('updater.install_failed', { error: String(error) }))
              }
            },
          },
        })
      } catch (error) {
        toast.dismiss(id)
        toast.error(i18n.t('updater.install_failed', { error: String(error) }))
      } finally {
        useUpdaterStore.setState({ isInstalling: false })
      }
    })
    .finally(() => {
      installPromise = undefined
    })
  useUpdaterStore.setState({ update: currentUpdate, isInstalling: true })
  return installPromise
}

export const fetchUpdate = (): Promise<Update | null> => {
  const state = useUpdaterStore.getState()
  if (state.installedVersion) return Promise.resolve(null)
  if (state.isInstalling) return Promise.resolve(state.update)
  if (checkPromise) return checkPromise

  checkPromise = (async () => {
    let update: Update | null

    try {
      try {
        update = await check({
          headers: {
            'X-AccessKey': 'Z_a1MB4UFk1vRd-v7D11Zw',
          },
        })
      } catch (error) {
        logger.error('Check update error1:', error)
        update = await check()
      }
    } catch (error) {
      toast.error(i18n.t('updater.check_failed', { error: String(error) }))
      logger.error('Check update error2:', error)
      return useUpdaterStore.getState().update
    }

    const latestState = useUpdaterStore.getState()
    if (latestState.installedVersion || latestState.isInstalling) {
      if (update && update !== latestState.update) await closeUpdate(update)
      return useUpdaterStore.getState().update
    }

    // A new check owns a separate native resource, even for the same release.
    if (update && latestState.update?.version === update.version) {
      if (update !== latestState.update) await closeUpdate(update)
      return useUpdaterStore.getState().update
    }

    useUpdaterStore.setState({ update })
    if (latestState.update) await closeUpdate(latestState.update)
    return useUpdaterStore.getState().update
  })().finally(() => {
    checkPromise = undefined
  })

  return checkPromise
}

export const checkUpdate = async () => {
  const previousVersion = useUpdaterStore.getState().update?.version
  const update = await fetchUpdate()
  if (!update || update.version === previousVersion || useUpdaterStore.getState().isInstalling) return

  toast.info(i18n.t('about.newVersion'), {
    id: 'available-update',
    description: `v${update.version}`,
    duration: Infinity,
    action: {
      label: i18n.t('updater.download_and_install'),
      onClick: () => { void installUpdate(update) },
    },
  })
}

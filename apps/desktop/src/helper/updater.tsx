import { dialog } from '@/services/dialog'
import { invoke } from '@tauri-apps/api/core'
import type { Update } from '@tauri-apps/plugin-updater'
import { check } from '@tauri-apps/plugin-updater'
import { getI18n } from '@/i18n'
import Markdown from 'react-markdown'
import { toast } from 'zens'
import { logger } from './logger'

export const installUpdate = async (update: Update) => {
  const id = toast.loading('Downloading new version...')

  try {
    await update.downloadAndInstall()
    toast.dismiss(id)
    toast.success('Update new version success!', {
      action: {
        label: 'Restart',
        onClick: () => {
          invoke('app_restart')
        },
      },
    })
  } catch (error) {
    toast.dismiss(id)
    toast.error(`Update new version error: ${error}`)
  }
}

export const checkUpdate = async (opt: { install: boolean } = { install: false }) => {
  try {
    const i18n = getI18n()

    let update = null

    try {
      update = await check({
        headers: {
          'X-AccessKey': 'Z_a1MB4UFk1vRd-v7D11Zw',
        },
      })
    } catch (error) {
      logger.error('Check update error1:', error)

      try {
        update = await check()
      } catch (e) {
        toast.error(`Check update error: ${e}`)
        logger.error('Check update error2:', e)
      }
      return
    }

    if (update !== null) {
      if (opt.install) {
        installUpdate(update)
      } else {
        const dateString = (update?.date || '').split('.')[0]

        const action = await dialog.confirm({
          title: `New version ${update.version}`,
          content: (
            <div>
              <Markdown>{update.body}</Markdown>
              <p>
                <small>{dateString}</small>
              </p>
            </div>
          ),
          actions: [
            { id: 'cancel', label: i18n.t('common.cancel') },
            { id: 'install', label: i18n.t('about.install'), primary: true },
          ],
        })

        if (action === 'install') {
          installUpdate(update)
        }
      }
    }
  } catch (error) {
    toast.error(`Update new version error: ${error}`)
  }
}

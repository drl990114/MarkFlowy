import { MODAL_CONFIRM_ID } from '@/components/Modal'
import NiceModal from '@ebay/nice-modal-react'
import { toast } from 'zens'
import { invoke } from '@tauri-apps/api/core'
import type { Update } from '@tauri-apps/plugin-updater'
import { check } from '@tauri-apps/plugin-updater'
import { getI18n } from 'react-i18next'
import Markdown from 'react-markdown'

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
        }
      }
    })
  } catch (error) {
    toast.dismiss(id)
    toast.error(`Update new version error: ${error}`)
  }
}

export const checkUpdate = async (opt: { install: boolean } = { install: false }) => {
  try {
    const i18n = getI18n()

    const update = await check()

    if (update !== null) {
      if (opt.install) {
        installUpdate(update)
      } else {
        const dateString = (update?.date || '').split('.')[0]

        NiceModal.show(MODAL_CONFIRM_ID, {
          title: `New version ${update.version}`,
          content: (
            <div>
              <Markdown>{update.body}</Markdown>
              <p>
                <small>{dateString}</small>
              </p>
            </div>
          ),
          confirmText: i18n.t('about.install'),
          onConfirm: () => installUpdate(update),
        })
      }
    }
  } catch (error) {
    toast.error(`Update new version error: ${error}`)
  }
}

import { MODAL_CONFIRM_ID } from '@/components/Modal'
import NiceModal from '@ebay/nice-modal-react'
import { Button, toast } from 'zens'
import { invoke } from '@tauri-apps/api/core'
import type { Update } from '@tauri-apps/plugin-updater'
import { check } from '@tauri-apps/plugin-updater'
import { getI18n } from 'react-i18next'
import styled from 'styled-components'
import Markdown from 'react-markdown'

const Content = styled.div`
  margin-bottom: ${({ theme }) => theme?.spaceXs};
`

export const installUpdate = async (update: Update) => {
  toast.promise(update.downloadAndInstall(), {
    loading: 'Downloading new version...',
    success: (
      <div>
        <Content> Update new version success!</Content>
        <Button size='small' onClick={() => invoke('app_restart')}>
          Restart
        </Button>
      </div>
    ),
    error: 'Update new version error',
  })
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

import { Button, toast } from '@markflowy/components'
import { invoke } from '@tauri-apps/api/primitives'
import type { Update } from '@tauri-apps/plugin-updater'
import { check } from '@tauri-apps/plugin-updater'
import styled from 'styled-components'

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
    const update = await check()
    if (update !== null) {
      if (opt.install) {
        installUpdate(update)
      } else {
        toast(
          <div>
            <Content> Has new version !</Content>
            <Button size='small' onClick={() => installUpdate(update)}>
              Install
            </Button>
          </div>,
          {
            duration: 10000,
          },
        )
      }

    }
  } catch (error) {
    toast.error(`Update new version error: ${error}`)
  }
}

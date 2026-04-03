import { EVENT } from '@/constants'
import { currentWindow } from '@/services/windows'
import useAppInfoStore from '@/stores/useAppInfoStore'
import { writeText } from '@tauri-apps/plugin-clipboard-manager'
import type { FC } from 'react'
import { memo, useCallback, useEffect, useState } from 'react'
import { AppInfoDialog as AppInfoDialogUI } from '@markflowy/interface'

const AboutDialog: FC = () => {
  const [open, setOpen] = useState(false)
  const { appInfo } = useAppInfoStore()

  useEffect(() => {
    const unlisten = currentWindow.listen(EVENT.app_about, () => setOpen(true))
    return () => {
      unlisten.then((fn) => fn())
    }
  }, [])

  const getAppInfoDesc = useCallback(() => {
    return `
AppName: ${appInfo.name}
Version: ${appInfo.version}
TauriVersion: ${appInfo.tauriVersion}
`
  }, [appInfo])

  const handleCopyAppInfo = useCallback(() => {
    writeText(getAppInfoDesc())
    setOpen(false)
  }, [getAppInfoDesc])

  const handleClose = useCallback(() => setOpen(false), [])

  return (
    <AppInfoDialogUI
      open={open}
      appInfo={{
        name: appInfo.name,
        version: appInfo.version,
        extraInfo: `Tauri Version: ${appInfo.tauriVersion}`,
      }}
      onClose={handleClose}
      onCopy={handleCopyAppInfo}
    />
  )
}

export default memo(AboutDialog)

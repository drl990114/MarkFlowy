import React from 'react'
import type { FC } from 'react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Dialog } from 'zens'

export interface AppInfo {
  name: string
  version: string
  extraInfo?: string
}

export interface AppInfoDialogProps {
  open: boolean
  appInfo: AppInfo
  onClose: () => void
  onCopy?: (appInfo: AppInfo) => void
}

const AppInfoDialog: FC<AppInfoDialogProps> = (props) => {
  const { open, appInfo, onClose, onCopy } = props
  const { t } = useTranslation()

  const handleCopyAppInfo = () => {
    onCopy?.(appInfo)
    onClose()
  }

  return (
    <Dialog
      open={open}
      title={appInfo.name}
      onClose={onClose}
      footer={[
        <Button key='ok' onClick={onClose}>
          {t('common.ok')}
        </Button>,
        <Button key='copy' btnType='primary' onClick={handleCopyAppInfo}>
          {t('common.copy')}
        </Button>,
      ]}
    >
      <div style={{ lineHeight: '24px' }}>
        <span>{`${t('about.version')}: ${appInfo.version}`}</span>
        {appInfo.extraInfo ? (
          <>
            <br />
            <span>{appInfo.extraInfo}</span>
          </>
        ) : null}
      </div>
    </Dialog>
  )
}

export default memo(AppInfoDialog)

import { t } from 'i18next'
import React from 'react'

interface UnsupportedFileTypeProps {}

export const UnsupportedFileType: React.FC<UnsupportedFileTypeProps> = () => {
  return (
    <div
      style={{
        height: "166px",
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <h3>{t('file.unsupportedFileType')}</h3>
    </div>
  )
}

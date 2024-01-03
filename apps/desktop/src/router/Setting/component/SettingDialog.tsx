import { Dialog } from '@markflowy/components'
import { Setting } from '@/router'
import { memo, useCallback, useEffect, useState } from 'react'
import { useCommandStore } from '@/stores'
import styled from 'styled-components'

const SettingDialogWrapper = styled(Dialog)`
  height: 80vh;
  overflow: hidden;
  background-color: ${(props) => props.theme.bgColor};
`

export const SettingDialog = memo(() => {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    useCommandStore.getState().addCommand({
      id: 'open_setting_dialog',
      handler: () => {
        setOpen(true)
      },
    })
  }, [])

  const handleClose = useCallback(() => setOpen(false), [])

  return (
    <SettingDialogWrapper width="90vw" title='Setting' open={open} onClose={handleClose}>
      <Setting />
    </SettingDialogWrapper>
  )
})

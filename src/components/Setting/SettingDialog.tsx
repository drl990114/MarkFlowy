import type { FC } from 'react'
import { memo, useCallback, useEffect, useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import { listen } from '@tauri-apps/api/event'

import * as React from 'react'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import { BootstrapDialogTitle } from '../AppInfoDialog'
import { CacheManager } from '@utils'
import SettingGroup from './SettingGroup'

export interface DialogTitleProps {
  children?: React.ReactNode
  onClose: () => void
}

function a11yProps(index: number) {
  return {
    id: `vertical-tab-${index}`,
    'aria-controls': `vertical-tabpanel-${index}`,
  }
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props

  return (
    <div role="tabpanel" hidden={value !== index} id={`vertical-tabpanel-${index}`} aria-labelledby={`vertical-tab-${index}`} {...other}>
      {value === index && (
        <Box sx={{ p: 3 }}>
          <Typography>{children}</Typography>
        </Box>
      )}
    </div>
  )
}

export function VerticalTabs() {
  const [value, setValue] = React.useState(0)

  const settingData = CacheManager.settingData
  const settingDataGroups = Object.keys(settingData)

  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue)
  }

  const curGroupKey = settingDataGroups[value]
  const curGroup = settingData[curGroupKey]
  const curGroupKeys = Object.keys(curGroup)

  return (
    <Box sx={{ flexGrow: 1, bgcolor: 'background.paper', display: 'flex', height: 224 }}>
      <Tabs orientation="vertical" variant="scrollable" value={value} onChange={handleChange} aria-label="Vertical tabs example" sx={{ borderRight: 1, borderColor: 'divider' }}>
        {settingDataGroups.map((group, index) => {
          return <Tab label="General" {...a11yProps(index)} />
        })}
      </Tabs>
      <TabPanel value={value} index={0}>
        {curGroupKeys.map((key) => {
          return <SettingGroup group={curGroup[key]} groupKey={key} categoryKey={curGroupKey} />
        })}
      </TabPanel>
    </Box>
  )
}

const SettingDialog: FC = () => {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const unlisten = listen('dialog_setting', () => setOpen(true))

    return () => {
      unlisten.then((fn) => fn())
    }
  }, [])

  const handleClose = useCallback(() => setOpen(false), [])

  return (
    <Dialog open={open}>
      <BootstrapDialogTitle onClose={handleClose}>{'Setting'}</BootstrapDialogTitle>
      <DialogContent style={{ width: 600 }}>
        <VerticalTabs />
      </DialogContent>
    </Dialog>
  )
}

export default memo(SettingDialog)

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

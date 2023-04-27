import type { FC } from 'react'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import { listen } from '@tauri-apps/api/event'

import * as React from 'react'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import { Autocomplete } from '@mui/material'
import { Cache } from '@utils'
import type { Langs } from '../../i18n'
import { locales } from '../../i18n'
import { BootstrapDialogTitle } from '../AppInfoDialog'
export interface DialogTitleProps {
  children?: React.ReactNode
  onClose: () => void
}

function a11yProps(index: number) {
  return {
    'id': `vertical-tab-${index}`,
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

  const options = useMemo(() => {
    const res: { title: string; value: Langs }[] = []
    const Keys = Object.keys(locales) as Langs[]
    Keys.forEach(key => res.push({ title: locales[key], value: key }))

    return res
  }, [])

  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue)
  }

  return (
    <Box sx={{ flexGrow: 1, bgcolor: 'background.paper', display: 'flex', height: 224 }}>
      <Tabs orientation="vertical" variant="scrollable" value={value} onChange={handleChange} aria-label="Vertical tabs example" sx={{ borderRight: 1, borderColor: 'divider' }}>
        <Tab label="General" {...a11yProps(0)} />
      </Tabs>
      <TabPanel value={value} index={0}>
        <label>
          language:
          <Autocomplete
            sx={{
              'display': 'inline-block',
              '& input': {
                width: 200,
                bgcolor: 'background.paper',
                color: theme => theme.palette.getContrastText(theme.palette.background.paper),
              },
            }}
            value={options.find(option => option.value === Cache.settingData.language)}
            options={options}
            getOptionLabel={(option) => {
              // Value selected with enter, right from the input
              if (typeof option === 'string')
                return option

              // Regular option
              return option.title
            }}
            renderOption={(props, option) => <li {...props}>{option.title}</li>}
            onChange={(_, value) => Cache.writeCache('language', value?.value)}
            renderInput={params => (
              <div ref={params.InputProps.ref}>
                <input type="text" {...params.inputProps} />
              </div>
            )}
          />
        </label>
      </TabPanel>
    </Box>
  )
}

const SettingDialog: FC = () => {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const unlisten = listen('dialog_setting', () => setOpen(true))

    return () => {
      unlisten.then(fn => fn())
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

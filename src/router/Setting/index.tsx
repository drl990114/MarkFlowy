import { memo } from 'react'
import * as React from 'react'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import { CacheManager } from '@utils'
import SettingGroup from '../../components/Setting/SettingGroup'
import { Container } from './styles'
import classNames from 'classnames'

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

function Setting() {
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
    <Container>
      <div id="sidebar">
        <h5 className='title'>Setting</h5>
        {/* TODO search */}
        {/* <div id="search-form" role="search">
          <input id="q" aria-label="Search contacts" placeholder="Search" type="search" name="q" />
        </div> */}
        <nav>
          <ul>
            {settingDataGroups.map((group, index) => {
              return (
                <li
                  className={classNames({
                    active: index === value,
                  })}
                  {...a11yProps(index)}
                >
                  {group}
                </li>
              )
            })}
          </ul>
        </nav>
      </div>
      <div id="detail">
        {curGroupKeys.map((key) => {
          return <SettingGroup group={curGroup[key]} groupKey={key} categoryKey={curGroupKey} />
        })}
      </div>
      {/* <Box sx={{ flexGrow: 1, bgcolor: 'background.paper', display: 'flex', height: 224 }}>
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
    </Box> */}
    </Container>
  )
}

export default memo(Setting)

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}
